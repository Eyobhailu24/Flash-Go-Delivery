'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PackageIcon,
  TagsIcon,
  UsersIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context';

const nav = [
  {
    href: '/admin',
    label: 'Overview',
    icon: LayoutDashboardIcon,
    exact: true,
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: UsersIcon,
    exact: false,
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: ClipboardListIcon,
    exact: false,
  },
  {
    href: '/admin/add-business',
    label: 'Add Business',
    icon: UsersIcon,
    exact: false,
  },
  {
    href: '/admin/add-driver',
    label: 'Add Driver',
    icon: UsersIcon,
    exact: false,
  },
  {
    href: '/admin/products',
    label: 'Products',
    icon: PackageIcon,
    exact: false,
  },
  {
    href: '/admin/product-categories',
    label: 'Product categories',
    icon: TagsIcon,
    exact: false,
  },
];

function isNavActive(
  pathname: string,
  href: string,
  exact: boolean,
) {
  if (exact) return pathname === href;
  return (
    pathname === href || pathname.startsWith(`${href}/`)
  );
}

function SidebarMenuToolbar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  if (collapsed && !isMobile) {
    return (
      <div className="mb-0.5 flex h-8 w-full items-center justify-center px-1">
        <SidebarTrigger className="size-8" />
      </div>
    );
  }

  return (
    <div className="mb-0.5 flex h-8 w-full min-w-0 shrink-0 items-center justify-between gap-2 px-2">
      <span className="truncate text-xs font-medium text-sidebar-foreground/70">
        Menu
      </span>
      <SidebarTrigger className="size-8 shrink-0" />
    </div>
  );
}

function AdminSidebarFooter() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <SidebarFooter className="border-t border-sidebar-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            onClick={() => void handleLogout()}
            tooltip="Log out"
          >
            <LogOutIcon />
            <span>Log out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/admin">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    FG
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      FlashGo
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Admin
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenuToolbar />
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map(
                  ({ href, label, icon: Icon, exact }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isNavActive(
                          pathname,
                          href,
                          exact,
                        )}
                        tooltip={label}
                      >
                        <Link href={href}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <AdminSidebarFooter />
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
