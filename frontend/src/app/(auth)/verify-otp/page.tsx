import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { VerifyOtpForm } from "./verify-otp-form";

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="size-8 text-primary" />
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  );
}
