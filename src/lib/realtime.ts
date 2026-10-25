import { redis } from "./redis";

export type Channel = `order:${string}` | `seller:${string}` | `rider:${string}` | "admin";

export type RealtimeEvent =
  | { type: "order.updated"; orderId: string; status?: string; message?: string }
  | { type: "seller.order"; sellerOrderId: string; orderId: string; status: string }
  | { type: "seller.new"; sellerOrderId: string; orderId: string }
  | { type: "rider.assigned"; deliveryId: string; orderId: string }
  | { type: "rider.location"; lat: number; lng: number }
  | { type: "refresh" };

export async function publish(channels: Channel | Channel[], event: RealtimeEvent) {
  const list = Array.isArray(channels) ? channels : [channels];
  const payload = JSON.stringify(event);
  await Promise.all(list.map((c) => redis.publish(`rt:${c}`, payload)));
}
