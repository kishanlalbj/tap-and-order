"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Crosshair, MapPin, PackageCheck, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/shared/form";
import { BENGALURU_AREAS, distanceM, formatDistance, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { goOffline, goOnline, markDelivered, markPickedUp } from "@/server/actions/rider";

type Props = {
  status: "OFFLINE" | "ONLINE" | "BUSY";
  initialLocation: LatLng | null;
  /** Where the rider should head next (a store, then the customer). */
  target: (LatLng & { label: string }) | null;
};

const TICK_MS = 3000;
const STEP_M = 120; // per tick when simulating, roughly a brisk city ride sped up for demos

function stepTowards(from: LatLng, to: LatLng, metres: number): LatLng {
  const d = distanceM(from, to);
  if (d <= metres) return to;
  const f = metres / d;
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}

async function sendLocation(loc: LatLng) {
  await fetch("/api/rider/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loc),
  }).catch(() => {});
}

/**
 * Online toggle and location reporting. In "simulate" mode the rider glides towards the next stop
 * so live tracking can be demoed from a desk; in GPS mode it reports the device position.
 */
export function RiderConsole({ status, initialLocation, target }: Props) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"simulate" | "gps">("simulate");
  const [loc, setLoc] = useState<LatLng>(initialLocation ?? BENGALURU_AREAS[1]);
  const locRef = useRef(loc);
  locRef.current = loc;

  const online = status !== "OFFLINE";

  const update = useCallback((next: LatLng) => {
    setLoc(next);
    void sendLocation(next);
  }, []);

  useEffect(() => {
    if (!online) return;
    if (mode === "gps") {
      if (!navigator.geolocation) return;
      const id = navigator.geolocation.watchPosition(
        (p) => update({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => toast.error("GPS unavailable. Switch to simulated location."),
        { enableHighAccuracy: true },
      );
      return () => navigator.geolocation.clearWatch(id);
    }
    const t = setInterval(() => {
      const cur = locRef.current;
      update(target ? stepTowards(cur, target, STEP_M) : cur);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [online, mode, target, update]);

  const toggle = () =>
    start(async () => {
      const res = online ? await goOffline() : await goOnline(loc);
      if (res.error) toast.error(res.error);
      else toast(online ? "You're offline" : "You're online. Waiting for orders.");
    });

  const toTarget = target ? distanceM(loc, target) : null;

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-3 rounded-full",
            status === "OFFLINE" ? "bg-zinc-300" : status === "BUSY" ? "bg-violet-500" : "animate-pulse bg-emerald-500",
          )}
        />
        <div className="flex-1">
          <p className="font-semibold">{status === "OFFLINE" ? "Offline" : status === "BUSY" ? "On a delivery" : "Online"}</p>
          <p className="text-xs text-muted-foreground">
            {status === "ONLINE" ? "You'll be assigned the nearest order automatically" : status === "OFFLINE" ? "Go online to receive orders" : "Complete the stops below"}
          </p>
        </div>
        <Button
          variant={online ? "outline" : "default"}
          disabled={pending || status === "BUSY"}
          onClick={toggle}
        >
          <Power /> {online ? "Go offline" : "Go online"}
        </Button>
      </div>

      <div className="grid gap-2 rounded-lg bg-muted/60 p-3 text-sm">
        <div className="flex items-center gap-2">
          <Crosshair className="size-4 text-primary" />
          <span className="font-mono text-xs">
            {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
          </span>
          <select
            className={cn(selectClass, "ml-auto h-7 w-auto bg-background text-xs")}
            value={mode}
            onChange={(e) => setMode(e.target.value as "simulate" | "gps")}
          >
            <option value="simulate">Simulated location</option>
            <option value="gps">Device GPS</option>
          </select>
        </div>
        {mode === "simulate" && !target && (
          <div className="flex flex-wrap gap-1.5">
            {BENGALURU_AREAS.map((a) => (
              <button
                key={a.label}
                className="rounded-full border bg-background px-2 py-0.5 text-xs hover:border-primary"
                onClick={() => update(a)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {target && toTarget !== null && (
          <p className="flex items-center gap-1.5 text-xs">
            <MapPin className="size-3.5 text-primary" />
            {toTarget < 40 ? `Arrived at ${target.label}` : `${formatDistance(toTarget)} to ${target.label}`}
          </p>
        )}
      </div>
    </section>
  );
}

export function PickupButton({ sellerOrderId, ready }: { sellerOrderId: string; ready: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={!ready || pending}
      onClick={() =>
        start(async () => {
          const res = await markPickedUp(sellerOrderId);
          if (res.error) toast.error(res.error);
          else toast.success("Picked up");
        })
      }
    >
      <PackageCheck /> {ready ? "Picked up" : "Waiting for store"}
    </Button>
  );
}

export function DeliveredButton({ deliveryId, ready }: { deliveryId: string; ready: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="w-full"
      size="lg"
      disabled={!ready || pending}
      onClick={() =>
        start(async () => {
          const res = await markDelivered(deliveryId);
          if (res.error) toast.error(res.error);
          else toast.success("Delivered! Nice work.");
        })
      }
    >
      <CheckCircle2 /> Mark delivered
    </Button>
  );
}
