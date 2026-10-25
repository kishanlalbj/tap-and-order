"use client";

import { useEffect, useState } from "react";
import { Bike, Navigation } from "lucide-react";
import { distanceM, formatDistance, type LatLng } from "@/lib/geo";

type Props = {
  orderId: string;
  destination: LatLng;
  rider: { name: string; vehicle: string; phone: string | null; location: LatLng | null };
  heading: string;
};

/** Live rider card: listens for `rider.location` events on the order channel. */
export function RiderTracker({ orderId, destination, rider, heading }: Props) {
  const [loc, setLoc] = useState(rider.location);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/stream?channel=${encodeURIComponent(`order:${orderId}`)}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "rider.location") {
        setLoc({ lat: event.lat, lng: event.lng });
        setUpdatedAt(new Date());
      }
    };
    return () => es.close();
  }, [orderId]);

  const away = loc ? distanceM(loc, destination) : null;
  // Rough city speed of ~20 km/h on a two-wheeler.
  const etaMin = away !== null ? Math.max(1, Math.round(away / 333)) : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
        <Bike className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {rider.name} <span className="font-normal text-muted-foreground">· {rider.vehicle}</span>
        </p>
        <p className="text-xs text-muted-foreground">{heading}</p>
      </div>
      {away !== null && (
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-sm font-semibold">
            <Navigation className="size-3.5 text-primary" /> {formatDistance(away)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {etaMin} min away{updatedAt ? " · live" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
