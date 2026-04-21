import { SegmentAccessGuard } from "@/components/auth/segment-access-guard";
import { BusinessAppShell } from "@/components/business/business-app-shell";

export default function BusinessLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SegmentAccessGuard segment="business">
      <BusinessAppShell>{children}</BusinessAppShell>
    </SegmentAccessGuard>
  );
}
