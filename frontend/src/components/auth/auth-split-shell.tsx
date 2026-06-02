import type { ReactNode } from "react";

export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-theme relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-180px] mx-auto h-[460px] w-[720px] rounded-full bg-orange-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-140px] bottom-[-140px] h-[320px] w-[320px] rounded-full bg-amber-300/25 blur-3xl"
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-orange-100/70 bg-white/90 p-6 shadow-xl shadow-orange-100/80 backdrop-blur-sm sm:p-8">
          <div className="space-y-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
