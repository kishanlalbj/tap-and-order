import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function Field({ label, hint, ...props }: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>;
}
