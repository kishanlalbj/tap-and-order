"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Crosshair, Home, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BENGALURU_AREAS } from "@/lib/geo";
import { chooseLocation, deleteAddress } from "@/server/actions/shop";

type Saved = { id: string; label: string; line: string; lat: number; lng: number };

type Props = {
  current: { label: string; line?: string; isDefault: boolean };
  saved: Saved[];
};

export function LocationPicker({ current, saved }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState({ lat: "", lng: "" });

  const pick = (loc: Parameters<typeof chooseLocation>[0]) =>
    startTransition(async () => {
      await chooseLocation(loc);
      setOpen(false);
      toast.success(`Delivering to ${loc.label}`);
    });

  const useGps = () => {
    if (!navigator.geolocation) return toast.error("Location isn't available in this browser");
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Current location" }),
      () => toast.error("Couldn't get your location — pick an area instead"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-muted">
        <MapPin className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 leading-tight">
          <span className="block text-[11px] font-semibold tracking-wide text-primary uppercase">Deliver to</span>
          <span className="flex items-center gap-0.5 truncate text-sm font-medium">
            {current.label}
            <ChevronDown className="size-3.5 shrink-0" />
          </span>
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose delivery location</DialogTitle>
          <DialogDescription>We show stores and prices that can deliver to this spot.</DialogDescription>
        </DialogHeader>

        <Button variant="outline" onClick={useGps} disabled={pending} className="justify-start">
          <Crosshair /> Use my current location
        </Button>

        {saved.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Saved addresses</p>
            {saved.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2">
                <button
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() => pick({ lat: a.lat, lng: a.lng, label: a.label, line: a.line, addressId: a.id })}
                  disabled={pending}
                >
                  <Home className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.line}</span>
                  </span>
                </button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete address"
                  onClick={() => startTransition(() => deleteAddress(a.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Popular areas in Bengaluru</p>
          <div className="grid grid-cols-2 gap-2">
            {BENGALURU_AREAS.map((a) => (
              <Button
                key={a.label}
                variant={a.label === current.label ? "default" : "secondary"}
                disabled={pending}
                onClick={() => pick(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const lat = Number(manual.lat);
            const lng = Number(manual.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !manual.lat || !manual.lng)
              return toast.error("Enter a valid latitude and longitude");
            pick({ lat, lng, label: `${lat.toFixed(3)}, ${lng.toFixed(3)}` });
          }}
        >
          <p className="text-xs font-medium text-muted-foreground">Or enter coordinates</p>
          <div className="flex gap-2">
            <Input placeholder="Latitude" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} />
            <Input placeholder="Longitude" value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} />
            <Button type="submit" variant="outline" disabled={pending}>
              Go
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
