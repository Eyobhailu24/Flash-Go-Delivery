import Image from "next/image";
import type { ReactNode } from "react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=85&auto=format&fit=crop";

export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-theme min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:grid md:grid-cols-2">
        <div className="order-1 flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:order-0 md:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md space-y-8">{children}</div>
        </div>
        <div className="order-2 relative min-h-[32vh] md:order-0 md:min-h-screen">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
          />
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2 md:bottom-10"
            aria-hidden
          >
            <span className="size-2 rounded-full bg-white/35" />
            <span className="size-2 rounded-full bg-primary" />
            <span className="size-2 rounded-full bg-white/35" />
          </div>
        </div>
      </div>
    </div>
  );
}
