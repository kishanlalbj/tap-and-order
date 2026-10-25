import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fromPoint } from "@/lib/geo";
import { connection, QUEUES, type JobData } from "@/lib/queue";
import {
  assignRider,
  NoRiderAvailableError,
  postLedgerForOrder,
  rejectSellerOrder,
} from "@/server/domain/orders";
import { nearestAvailableRiders } from "@/server/domain/riders";

const log = (queue: string, msg: string) =>
  console.log(`${new Date().toISOString().slice(11, 19)} [${queue}] ${msg}`);

const processors: { [N in keyof JobData]: (job: Job<JobData[N]>) => Promise<unknown> } = {
  async "seller-orders"(job) {
    const { sellerOrderId } = job.data;
    const rejected = await rejectSellerOrder(sellerOrderId, {
      reason: "Store didn't respond in time — finding another store",
      actor: null,
    });
    log("seller-orders", `${sellerOrderId} ${rejected ? "timed out → reassigned" : "already handled"}`);
  },

  async dispatch(job) {
    const { orderId } = job.data;
    const [delivery] = await db
      .select({ status: schema.deliveries.status })
      .from(schema.deliveries)
      .where(eq(schema.deliveries.orderId, orderId));
    if (delivery?.status !== "SEARCHING") return "not searching";

    // Search around the first store the rider will visit.
    const [store] = await db
      .select({ location: schema.sellers.location })
      .from(schema.sellerOrders)
      .innerJoin(schema.sellers, eq(schema.sellers.id, schema.sellerOrders.sellerId))
      .where(eq(schema.sellerOrders.orderId, orderId))
      .limit(1);
    const candidates = await nearestAvailableRiders(fromPoint(store.location));
    try {
      const riderId = await assignRider(orderId, candidates);
      log("dispatch", `${orderId} → rider ${riderId ?? "(already assigned)"}`);
    } catch (err) {
      if (err instanceof NoRiderAvailableError) {
        log("dispatch", `${orderId} no rider yet (attempt ${job.attemptsMade + 1}), retrying`);
      }
      throw err;
    }
  },

  async ledger(job) {
    const n = await postLedgerForOrder(job.data.orderId);
    log("ledger", `${job.data.orderId} posted ${n} seller settlement(s)`);
  },

  async notifications(job) {
    // Stand-in for an SMS / email / push provider.
    const { to, channel, message } = job.data;
    log("notifications", `${channel.toUpperCase()} → user ${to.slice(0, 8)}: ${message}`);
  },
};

const workers = (Object.keys(processors) as (keyof JobData)[]).map((name) => {
  const worker = new Worker(name, processors[name] as (job: Job) => Promise<unknown>, {
    connection,
    concurrency: name === "notifications" ? 20 : 5,
  });
  worker.on("failed", (job, err) => {
    if (!(err instanceof NoRiderAvailableError)) console.error(`[${name}] job ${job?.id} failed:`, err);
  });
  return worker;
});

log("worker", `listening on ${Object.values(QUEUES).join(", ")}`);

async function shutdown() {
  log("worker", "shutting down…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

