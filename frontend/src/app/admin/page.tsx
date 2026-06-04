"use client";

import { UsersIcon, ShieldCheckIcon, Building2Icon, TruckIcon } from "lucide-react";
import { useMemo } from "react";
import { useUsers } from "@/app/admin/_hooks/use-users";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function countByRole(
  users: { role: string }[],
  role: string,
): number {
  return users.filter((u) => u.role === role).length;
}

export default function AdminOverviewPage() {
  const { users, loading, error, limit } = useUsers({
    limit: 200,
    offset: 0,
  });

  const stats = useMemo(() => {
    return {
      loaded: users.length,
      customers: countByRole(users, "customer"),
      drivers: countByRole(users, "driver"),
      businesses: countByRole(users, "business"),
      admins: countByRole(users, "admin"),
    };
  }, [users]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot from the latest user list (up to {limit} users per request).
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex min-w-0 w-full flex-row flex-nowrap gap-3 sm:gap-4">
        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Users loaded</CardTitle>
            <UsersIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
          </CardHeader>
          <CardContent className="px-4 pt-0 sm:px-6">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-xl font-bold sm:text-2xl">{stats.loaded}</p>
            )}
            <CardDescription className="mt-1 text-xs leading-snug">
              Rows in this response.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Customers</CardTitle>
            <UsersIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
          </CardHeader>
          <CardContent className="px-4 pt-0 sm:px-6">
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-xl font-bold sm:text-2xl">{stats.customers}</p>
            )}
            <CardDescription className="mt-1 text-xs">In loaded set</CardDescription>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Drivers</CardTitle>
            <TruckIcon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
          </CardHeader>
          <CardContent className="px-4 pt-0 sm:px-6">
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-xl font-bold sm:text-2xl">{stats.drivers}</p>
            )}
            <CardDescription className="mt-1 text-xs">In loaded set</CardDescription>
          </CardContent>
        </Card>

        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Businesses</CardTitle>
            <Building2Icon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
          </CardHeader>
          <CardContent className="px-4 pt-0 sm:px-6">
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-xl font-bold sm:text-2xl">{stats.businesses}</p>
            )}
            <CardDescription className="mt-1 text-xs">In loaded set</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheckIcon className="size-4" />
            Admins & verification
          </CardTitle>
          <CardDescription>
            Quick counts from the same loaded user batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          {loading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <>
              <div>
                <p className="text-muted-foreground">Admin users</p>
                <p className="text-xl font-semibold">{stats.admins}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verified (loaded)</p>
                <p className="text-xl font-semibold">
                  {users.filter((u) => u.isVerified).length}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
