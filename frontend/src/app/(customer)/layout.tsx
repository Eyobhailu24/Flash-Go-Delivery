import { SegmentAccessGuard } from "@/components/auth/segment-access-guard";
import { CustomerSessionWelcome } from "@/components/customer/customer-session-welcome";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <CustomerSessionWelcome />
      <SegmentAccessGuard segment="customer">{children}</SegmentAccessGuard>
    </div>
  );
}
