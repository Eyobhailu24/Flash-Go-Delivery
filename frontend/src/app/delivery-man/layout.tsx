import { SegmentAccessGuard } from "@/components/auth/segment-access-guard";

export default function DeliveryManLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SegmentAccessGuard segment="driver">{children}</SegmentAccessGuard>;
}
