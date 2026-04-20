"use client";

import { format } from "date-fns";
import {
  ClipboardListIcon,
  Loader2Icon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminOrderById,
  fetchAvailableDrivers,
  patchAdminOrder,
  useAdminOrders,
  type AdminOrderDetail,
  type AdminOrderRow,
} from "@/app/admin/_hooks/use-admin-orders";
import type { User } from "@/app/admin/_hooks/use-users";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchCategoryItems,
  catalogItemImageUrl,
  type CategoryItem,
} from "@/lib/admin-catalog-api";
import { AuthApiError } from "@/lib/auth-api";

type WorkingLine = {
  key: string;
  categoryItemId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
};

function statusVariant(
  status: AdminOrderRow["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "delivered") return "secondary";
  if (status === "cancelled") return "destructive";
  if (status === "in_transit") return "default";
  return "outline";
}

function detailFromWorking(detail: AdminOrderDetail, lines: WorkingLine[]) {
  return {
    ...detail,
    items: lines.map((line, i) => ({
      id: `local-${i}`,
      orderId: detail.order.id,
      categoryItemId: line.categoryItemId,
      productName: line.productName,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: (
        Number(line.unitPrice) * line.quantity
      ).toFixed(2),
    })),
    order: {
      ...detail.order,
      totalPrice: lines
        .reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0)
        .toFixed(2),
    },
  };
}

export default function AdminOrdersPage() {
  const { orders, loading, error, refetch } = useAdminOrders();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [workingLines, setWorkingLines] = useState<WorkingLine[]>([]);
  const [legacyLines, setLegacyLines] = useState(0);

  const [drivers, setDrivers] = useState<User[]>([]);
  const [driverDraft, setDriverDraft] = useState<string>("__none__");
  const [savingItems, setSavingItems] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [catalogHits, setCatalogHits] = useState<CategoryItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const d = await fetchAdminOrderById(id);
      setDetail(d);
      const mapped: WorkingLine[] = [];
      let legacy = 0;
      for (const row of d.items) {
        if (row.categoryItemId) {
          mapped.push({
            key: row.id,
            categoryItemId: row.categoryItemId,
            productName: row.productName,
            unitPrice: row.unitPrice,
            quantity: row.quantity,
          });
        } else {
          legacy += 1;
        }
      }
      setWorkingLines(mapped);
      setLegacyLines(legacy);
      setDriverDraft(d.order.driverId ?? "__none__");
    } catch (e) {
      const msg =
        e instanceof AuthApiError ? e.message : "Could not load this order.";
      toast.error(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    try {
      const list = await fetchAvailableDrivers();
      setDrivers(list);
    } catch {
      toast.error("Could not load drivers.");
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!sheetOpen || !selectedId) return;
    void loadDetail(selectedId);
    void loadDrivers();
  }, [sheetOpen, selectedId, loadDetail, loadDrivers]);

  const driverOptions = useMemo(() => {
    const map = new Map<string, User>();
    for (const d of drivers) {
      map.set(d.id, d);
    }
    if (detail?.driver && !map.has(detail.driver.id)) {
      map.set(detail.driver.id, {
        id: detail.driver.id,
        fullName: detail.driver.fullName,
        email: "",
        phoneNumber: detail.driver.phoneNumber,
        role: "driver",
        status: "active",
        isVerified: true,
        verifiedAt: null,
        createdAt: "",
      });
    }
    return [...map.values()];
  }, [drivers, detail?.driver]);

  const itemsEditable = detail?.payment?.status === "pending";

  const openOrder = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const saveLines = async () => {
    if (!selectedId || !detail) return;
    if (!itemsEditable) {
      toast.message("Items are locked after payment is no longer pending.");
      return;
    }
    if (workingLines.length === 0) {
      toast.error("Add at least one catalog line before saving.");
      return;
    }
    setSavingItems(true);
    try {
      const payload = {
        items: workingLines.map((l) => ({
          categoryItemId: l.categoryItemId,
          quantity: l.quantity,
        })),
      };
      const next = await patchAdminOrder(selectedId, payload);
      setDetail(next);
      toast.success("Order items updated.");
      void refetch();
    } catch (e) {
      const msg =
        e instanceof AuthApiError ? e.message : "Failed to update items.";
      toast.error(msg);
    } finally {
      setSavingItems(false);
    }
  };

  const applyDriver = async () => {
    if (!selectedId || !detail) return;
    const nextId = driverDraft === "__none__" ? null : driverDraft;
    setSavingDriver(true);
    try {
      const next = await patchAdminOrder(selectedId, {
        driverId: nextId,
      });
      setDetail(next);
      setDriverDraft(next.order.driverId ?? "__none__");
      toast.success(
        nextId ? "Driver assigned." : "Driver cleared from this order.",
      );
      void refetch();
      void loadDrivers();
    } catch (e) {
      const msg =
        e instanceof AuthApiError ? e.message : "Failed to update driver.";
      toast.error(msg);
    } finally {
      setSavingDriver(false);
    }
  };

  const runCatalogSearch = useCallback(async () => {
    if (!detail?.order.businessId) return;
    setCatalogLoading(true);
    try {
      const res = await fetchCategoryItems({
        businessId: detail.order.businessId,
        q: catalogQ.trim() || undefined,
        limit: 40,
        offset: 0,
      });
      setCatalogHits(res.items.filter((i) => i.isAvailable));
    } catch {
      toast.error("Search failed.");
      setCatalogHits([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [detail?.order.businessId, catalogQ]);

  useEffect(() => {
    if (!addOpen || !detail) return;
    const t = setTimeout(() => {
      void runCatalogSearch();
    }, 320);
    return () => clearTimeout(t);
  }, [addOpen, detail, runCatalogSearch]);

  const previewDetail = useMemo(() => {
    if (!detail) return null;
    return detailFromWorking(detail, workingLines);
  }, [detail, workingLines]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Orders
        </h1>
        <p className="text-muted-foreground text-sm">
          Review customer orders, adjust line items while payment is pending, and
          assign available drivers.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardListIcon className="size-5" aria-hidden />
              All orders
            </CardTitle>
            <CardDescription>
              Newest first. Select a row to open the editor.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void refetch()}
          >
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && orders.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>
                  When customers check out, their orders will show up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openOrder(row.id)}
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {format(new Date(row.createdAt), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.customer?.fullName ?? "—"}
                      </TableCell>
                      <TableCell>{row.business?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {row.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.totalPrice} ETB
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          side="right"
        >
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle className="font-heading">
              {detail ? `Order ${detail.order.id.slice(0, 8)}…` : "Order"}
            </SheetTitle>
            <SheetDescription>
              {detail?.business?.name ?? "Loading business…"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-6 p-4">
              {detailLoading || !detail ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="text-right font-medium">
                        {detail.customer?.fullName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Payment</span>
                      <span className="text-right">
                        {detail.payment?.status ?? "—"} ·{" "}
                        {detail.payment?.method ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-right font-semibold tabular-nums">
                        {previewDetail?.order.totalPrice ?? detail.order.totalPrice}{" "}
                        ETB
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">Line items</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!itemsEditable}
                        onClick={() => {
                          setCatalogQ("");
                          setAddOpen(true);
                          void runCatalogSearch();
                        }}
                      >
                        <PlusIcon className="size-4" />
                        Add item
                      </Button>
                    </div>
                    {!itemsEditable ? (
                      <p className="text-muted-foreground text-xs">
                        Editing items is only allowed while payment status is
                        pending.
                      </p>
                    ) : null}
                    {legacyLines > 0 ? (
                      <p className="text-amber-600 text-xs dark:text-amber-400">
                        {legacyLines} legacy line(s) without a catalog link are
                        not shown here. Contact support if totals look wrong.
                      </p>
                    ) : null}

                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                      {workingLines.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No catalog lines. Add items from the business menu.
                        </p>
                      ) : (
                        workingLines.map((line) => (
                          <div
                            key={line.key}
                            className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-sm">
                                {line.productName}
                              </p>
                              <p className="text-muted-foreground text-xs tabular-nums">
                                {line.unitPrice} ETB each
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={!itemsEditable}
                                onClick={() =>
                                  setWorkingLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key
                                        ? {
                                            ...l,
                                            quantity: Math.max(
                                              1,
                                              l.quantity - 1,
                                            ),
                                          }
                                        : l,
                                    ),
                                  )
                                }
                              >
                                <MinusIcon className="size-4" />
                              </Button>
                              <span className="w-6 text-center text-sm">
                                {line.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={!itemsEditable}
                                onClick={() =>
                                  setWorkingLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key
                                        ? { ...l, quantity: l.quantity + 1 }
                                        : l,
                                    ),
                                  )
                                }
                              >
                                <PlusIcon className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                disabled={!itemsEditable}
                                onClick={() =>
                                  setWorkingLines((prev) =>
                                    prev.filter((l) => l.key !== line.key),
                                  )
                                }
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <Button
                      type="button"
                      disabled={!itemsEditable || savingItems}
                      onClick={() => void saveLines()}
                    >
                      {savingItems ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : null}
                      Save line items
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-medium">Driver</h3>
                    <p className="text-muted-foreground text-xs">
                      Only drivers who are active and marked available appear in
                      the list. Assigning sets them unavailable until delivery or
                      reassignment.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="driver-select">Driver</Label>
                        <Select
                          value={driverDraft}
                          onValueChange={setDriverDraft}
                          disabled={
                            detail.order.status === "delivered" ||
                            detail.order.status === "in_transit" ||
                            detail.order.status === "cancelled"
                          }
                        >
                          <SelectTrigger id="driver-select" className="w-full">
                            <SelectValue placeholder="Choose driver" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              Unassigned
                            </SelectItem>
                            {driverOptions.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName}
                                {u.phoneNumber ? ` · ${u.phoneNumber}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        disabled={
                          savingDriver ||
                          detail.order.status === "delivered" ||
                          detail.order.status === "in_transit" ||
                          detail.order.status === "cancelled"
                        }
                        onClick={() => void applyDriver()}
                      >
                        {savingDriver ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : null}
                        Apply driver
                      </Button>
                    </div>
                    {detail.order.status === "in_transit" ? (
                      <p className="text-muted-foreground text-xs">
                        Driver cannot be changed while the order is in transit.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Add catalog item</DialogTitle>
            <DialogDescription>
              Search this business&apos;s menu, then tap an item to add it with
              quantity 1 (adjust quantity after).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name…"
                value={catalogQ}
                onChange={(e) => setCatalogQ(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => void runCatalogSearch()}
                aria-label="Search"
              >
                <SearchIcon className="size-4" />
              </Button>
            </div>
            <ScrollArea className="h-[min(50vh,360px)] pr-3">
              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : catalogHits.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No matches. Try another search.
                </p>
              ) : (
                <ul className="space-y-2">
                  {catalogHits.map((item) => {
                    const img = catalogItemImageUrl(item.imagePath);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg border bg-card p-2 text-left transition hover:bg-accent/60"
                          onClick={() => {
                            if (!itemsEditable) return;
                            const unit = (
                              Number(item.price) -
                              Number(item.discount ?? 0)
                            ).toFixed(2);
                            setWorkingLines((prev) => [
                              ...prev,
                              {
                                key: `${item.id}-${Date.now()}`,
                                categoryItemId: item.id,
                                productName: item.name,
                                unitPrice: unit,
                                quantity: 1,
                              },
                            ]);
                            setAddOpen(false);
                            toast.success(`Added “${item.name}”.`);
                          }}
                        >
                          <div className="bg-muted flex size-12 shrink-0 overflow-hidden rounded-md border">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element -- backend URL
                              <img
                                src={img}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm">
                              {item.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {item.categoryName ?? "Menu"} ·{" "}
                              {(
                                Number(item.price) -
                                Number(item.discount ?? 0)
                              ).toFixed(2)}{" "}
                              ETB
                            </p>
                          </div>
                          <PlusIcon className="text-muted-foreground size-4 shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
