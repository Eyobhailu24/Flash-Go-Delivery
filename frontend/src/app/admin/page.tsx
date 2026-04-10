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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users loaded</CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{stats.loaded}</p>
            )}
            <CardDescription className="mt-1">
              Rows in this response (not necessarily total in DB).
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{stats.customers}</p>
            )}
            <CardDescription className="mt-1">In loaded set</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drivers</CardTitle>
            <TruckIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{stats.drivers}</p>
            )}
            <CardDescription className="mt-1">In loaded set</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Businesses</CardTitle>
            <Building2Icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-2xl font-bold">{stats.businesses}</p>
            )}
            <CardDescription className="mt-1">In loaded set</CardDescription>
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
