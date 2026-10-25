import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", suffix, className }: { href?: string; suffix?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-1.5 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="size-4 fill-current" />
      </span>
      <span>
        Tap<span className="text-primary">&amp;</span>Order
      </span>
      {suffix && (
        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      )}
    </Link>
  );
}
