"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Props = {
  channel: string;
  /** Toast text keyed by event type, or `type:status` for a specific status. */
  toastOn?: Record<string, string>;
};

/** Subscribes to a realtime channel and re-renders the current server components on each event. */
export function LiveRefresh({ channel, toastOn }: Props) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastsRef = useRef(toastOn);
  toastsRef.current = toastOn;

  useEffect(() => {
    const es = new EventSource(`/api/stream?channel=${encodeURIComponent(channel)}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as { type: string; status?: string };
      if (event.type === "ready" || event.type === "rider.location") return;
      const toasts = toastsRef.current;
      const msg = (event.status && toasts?.[`${event.type}:${event.status}`]) || toasts?.[event.type];
      if (msg) toast(msg);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    return () => {
      clearTimeout(timer.current);
      es.close();
    };
  }, [channel, router]);

  return null;
}
