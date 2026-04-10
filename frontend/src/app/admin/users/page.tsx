"use client";

import { format } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LayoutGridIcon,
  TableIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUsers, type User } from "@/app/admin/_hooks/use-users";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const VIEW_STORAGE_KEY = "admin-users-view";

type SortField = "name" | "role" | "date";
type SortDir = "asc" | "desc";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

function sortUsers(
  list: User[],
  field: SortField,
  dir: SortDir,
): User[] {
  const next = [...list];
  const cmpName = (a: User, b: User) =>
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
  const cmpRole = (a: User, b: User) =>
    a.role.localeCompare(b.role) || cmpName(a, b);
  const cmpDate = (a: User, b: User) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (field === "name") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpName(a, b) : cmpName(b, a),
    );
  }
  if (field === "role") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpRole(a, b) : cmpRole(b, a),
    );
  }
  return next.sort((a, b) =>
    dir === "asc" ? cmpDate(a, b) : cmpDate(b, a),
  );
}

function filterUsers(list: User[], q: string): User[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((u) => {
    const hay = [
      u.fullName,
      u.email,
      u.phoneNumber ?? "",
      u.role,
      u.status,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(s);
  });
}

export default function AdminUsersPage() {
  const { users, loading, error, refetch } = useUsers({
    limit: 200,
    offset: 0,
  });

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  useEffect(() => {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "table" || raw === "cards") {
      queueMicrotask(() => setViewMode(raw));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const processed = useMemo(() => {
    return sortUsers(filterUsers(users, search), sortField, sortDir);
  }, [users, search, sortField, sortDir]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Search and sort the user list returned from the API (up to 200 per
            load).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:mt-0.5"
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 pt-4 md:p-6">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-4 overflow-x-auto">
            <div className="relative min-w-56 w-[58%] max-w-2xl shrink-0">
              <Input
                id="user-search"
                placeholder="Search name, email, phone, role…"
                className="h-9 w-full px-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
              <Select
                value={sortField}
                onValueChange={(v) => setSortField(v as SortField)}
              >
                <SelectTrigger
                  className="h-9 w-38 shrink-0 sm:w-40"
                  aria-label="Sort by field"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                  <SelectItem value="date">Date joined</SelectItem>
                </SelectContent>
              </Select>
              <div
                className="flex shrink-0 overflow-hidden rounded-md border border-input"
                role="group"
                aria-label="Sort direction"
              >
                <Button
                  type="button"
                  variant={sortDir === "asc" ? "secondary" : "ghost"}
                  size="icon-sm"
                  className="size-9 rounded-none border-0 shadow-none"
                  onClick={() => setSortDir("asc")}
                  aria-pressed={sortDir === "asc"}
                  title="Ascending (A→Z, oldest first for dates)"
                  aria-label="Sort ascending"
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={sortDir === "desc" ? "secondary" : "ghost"}
                  size="icon-sm"
                  className="size-9 rounded-none border-0 border-l border-input shadow-none"
                  onClick={() => setSortDir("desc")}
                  aria-pressed={sortDir === "desc"}
                  title="Descending (Z→A, newest first for dates)"
                  aria-label="Sort descending"
                >
                  <ArrowDownIcon className="size-4" />
                </Button>
              </div>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => {
                  if (v === "table" || v === "cards") setViewMode(v);
                }}
                variant="outline"
                spacing={0}
                className="shrink-0"
                aria-label="View mode"
              >
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon className="size-4" />
                  <span className="hidden sm:inline">Table</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" aria-label="Card view">
                  <LayoutGridIcon className="size-4" />
                  <span className="hidden sm:inline">Cards</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : processed.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No users match</EmptyTitle>
                <EmptyDescription>
                  Try another search term or refresh the list.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">{u.status}</Badge>
                        {u.isVerified ? (
                          <Badge className="bg-primary/15 text-primary-foreground hover:bg-primary/20">
                            Verified
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {u.phoneNumber ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {processed.map((u) => (
                <li key={u.id}>
                  <Card className="h-full shadow-none transition-colors hover:bg-accent/30">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/15 text-primary-foreground">
                          {initials(u.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base leading-tight">
                          {u.fullName}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {u.email}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{u.role}</Badge>
                        <Badge variant="outline">{u.status}</Badge>
                        {u.isVerified ? (
                          <Badge className="bg-primary/15 text-primary-foreground hover:bg-primary/20">
                            Verified
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {u.phoneNumber ?? "No phone"} ·{" "}
                        {format(new Date(u.createdAt), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
