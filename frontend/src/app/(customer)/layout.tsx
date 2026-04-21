import { SegmentAccessGuard } from "@/components/auth/segment-access-guard";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SegmentAccessGuard segment="customer">{children}</SegmentAccessGuard>
    </div>
  );
}
