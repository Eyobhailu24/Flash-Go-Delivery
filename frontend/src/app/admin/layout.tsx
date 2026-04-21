import { AdminShell } from "@/components/admin/admin-shell";
import { SegmentAccessGuard } from "@/components/auth/segment-access-guard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-dashboard min-h-svh">
      <AdminShell>
        <SegmentAccessGuard segment="admin">{children}</SegmentAccessGuard>
      </AdminShell>
    </div>
  );
}
