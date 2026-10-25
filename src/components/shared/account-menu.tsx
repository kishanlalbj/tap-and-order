"use client";

import { useRouter } from "next/navigation";
import { CircleUser, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/server/actions/auth";

type Props = {
  name: string;
  email: string;
  links: { href: string; label: string }[];
};

export function AccountMenu({ name, email, links }: Props) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
        <CircleUser className="size-5" />
        <span className="hidden max-w-28 truncate sm:inline">{name.split(" ")[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        {links.map((l) => (
          <DropdownMenuItem key={l.href} onClick={() => router.push(l.href)}>
            {l.label}
          </DropdownMenuItem>
        ))}
        {links.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onClick={() => logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
