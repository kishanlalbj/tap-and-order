"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = Omit<React.ComponentProps<typeof Button>, "action" | "onClick"> & {
  /** A server action already bound to its arguments. */
  action: () => Promise<{ error?: string; success?: string }>;
  confirm?: string;
  successMessage?: string;
};

export function ActionButton({ action, confirm: confirmText, successMessage, children, ...props }: Props) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const res = await action();
          if (res.error) toast.error(res.error);
          else if (res.success || successMessage) toast.success(res.success ?? successMessage);
        });
      }}
    >
      {children}
    </Button>
  );
}
