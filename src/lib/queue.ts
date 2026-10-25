import { Queue, type JobsOptions } from "bullmq";

export const connection = { url: process.env.REDIS_URL!, maxRetriesPerRequest: null };

export const QUEUES = {
  sellerOrders: "seller-orders",
  dispatch: "dispatch",
  ledger: "ledger",
  notifications: "notifications",
} as const;

export type JobData = {
  "seller-orders": { kind: "accept-timeout"; sellerOrderId: string };
  dispatch: { orderId: string };
  ledger: { orderId: string };
  notifications: { to: string; channel: "sms" | "email" | "push"; message: string };
};

type QueueName = keyof JobData;

const globalForQueues = globalThis as unknown as { queues?: Map<QueueName, Queue> };
const queues = (globalForQueues.queues ??= new Map());

// Queues are created lazily so importing this module never opens a connection (e.g. during `next build`).
function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection,
      defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
    });
    queues.set(name, q);
  }
  return q;
}

export async function enqueue<N extends QueueName>(name: N, data: JobData[N], opts?: JobsOptions) {
  return getQueue(name).add(name, data, opts);
}

export async function removeJob(name: QueueName, jobId: string) {
  const job = await getQueue(name).getJob(jobId);
  if (job) await job.remove().catch(() => {});
}

// BullMQ custom ids can't contain ":".
export const jobIds = {
  acceptTimeout: (sellerOrderId: string) => `accept-timeout-${sellerOrderId}`,
  dispatch: (orderId: string) => `dispatch-${orderId}`,
  ledger: (orderId: string) => `ledger-${orderId}`,
};
