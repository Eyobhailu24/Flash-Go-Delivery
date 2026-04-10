import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-dashboard min-h-svh">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
