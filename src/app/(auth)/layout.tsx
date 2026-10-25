import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Logo className="mb-8 text-lg" />
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
