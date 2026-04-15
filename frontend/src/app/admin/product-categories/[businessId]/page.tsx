"use client";

import { format } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LayoutGridIcon,
  TableIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserById, type User } from "@/app/admin/_hooks/use-users";
import {
  createProductCategory,
  fetchProductCategories,
  type ProductCategory,
} from "@/lib/admin-catalog-api";
import { PRESET_PRODUCT_CATEGORY_NAMES } from "@/lib/product-category-presets";
import { AuthApiError } from "@/lib/auth-api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const viewStorageKey = (businessId: string) =>
  `admin-product-categories-detail-view:${businessId}`;

type SortField = "name" | "sortOrder" | "date";
type SortDir = "asc" | "desc";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

function filterCategories(
  list: ProductCategory[],
  q: string,
): ProductCategory[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((c) => {
    const hay = [
      c.name,
      String(c.sortOrder),
      format(new Date(c.createdAt), "MMM d, yyyy"),
      c.createdAt,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(s);
  });
}

function sortCategories(
  list: ProductCategory[],
  field: SortField,
  dir: SortDir,
): ProductCategory[] {
  const next = [...list];
  const cmpName = (a: ProductCategory, b: ProductCategory) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const cmpOrder = (a: ProductCategory, b: ProductCategory) =>
    a.sortOrder - b.sortOrder;
  const cmpDate = (a: ProductCategory, b: ProductCategory) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (field === "name") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpName(a, b) : cmpName(b, a),
    );
  }
  if (field === "sortOrder") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpOrder(a, b) : cmpOrder(b, a),
    );
  }
  return next.sort((a, b) =>
    dir === "asc" ? cmpDate(a, b) : cmpDate(b, a),
  );
}

export default function AdminProductCategoriesForBusinessPage() {
  const router = useRouter();
  const params = useParams();
  const businessIdRaw = params.businessId;
  const businessId =
    typeof businessIdRaw === "string"
      ? businessIdRaw
      : Array.isArray(businessIdRaw)
        ? businessIdRaw[0]
        : "";

  const idValid = UUID_RE.test(businessId);

  const [owner, setOwner] = useState<User | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [modalOpen, setModalOpen] = useState(false);
  const [presetName, setPresetName] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!idValid) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchProductCategories(businessId, {
        limit: 100,
        offset: 0,
      });
      setCategories(data.categories);
    } catch (e) {
      setCategories([]);
      setListError(
        e instanceof AuthApiError
          ? e.message
          : "Could not load categories for this business.",
      );
    } finally {
      setListLoading(false);
    }
  }, [businessId, idValid]);

  useEffect(() => {
    if (!idValid) return;
    let cancelled = false;
    setOwnerError(null);
    void (async () => {
      try {
        const u = await fetchUserById(businessId);
        if (cancelled) return;
        if (u.role !== "business") {
          setOwner(null);
          setOwnerError("This user is not a business account.");
          return;
        }
        setOwner(u);
      } catch (e) {
        if (cancelled) return;
        setOwner(null);
        setOwnerError(
          e instanceof AuthApiError
            ? e.message
            : "Could not load business user.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, idValid]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!idValid) return;
    const raw = window.localStorage.getItem(viewStorageKey(businessId));
    if (raw === "table" || raw === "cards") {
      queueMicrotask(() => setViewMode(raw));
    }
  }, [businessId, idValid]);

  useEffect(() => {
    if (!idValid || typeof window === "undefined") return;
    window.localStorage.setItem(viewStorageKey(businessId), viewMode);
  }, [businessId, idValid, viewMode]);

  const processed = useMemo(() => {
    return sortCategories(
      filterCategories(categories, search),
      sortField,
      sortDir,
    );
  }, [categories, search, sortField, sortDir]);

  const resetModal = () => {
    setPresetName("");
    setSubmitError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) resetModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idValid || !presetName.trim()) {
      setSubmitError("Choose a category name from the list.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createProductCategory({
        businessId,
        name: presetName.trim(),
      });
      await loadCategories();
      setModalOpen(false);
      resetModal();
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError
          ? err.message
          : "Could not create category.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!idValid) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <Alert variant="destructive">
          <AlertTitle>Invalid link</AlertTitle>
          <AlertDescription>
            The business id in the URL is not valid.{" "}
            <Link
              href="/admin/product-categories"
              className="font-medium underline underline-offset-4"
            >
              Back to business list
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button variant="link" className="h-auto w-fit p-0" asChild>
            <Link href="/admin/product-categories">← All businesses</Link>
          </Button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {owner ? owner.fullName : "Business categories"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {owner
              ? owner.email
              : ownerError
                ? ownerError
                : "Loading business…"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and sort categories for this business. Preset names only when
            adding.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:mt-0.5"
          onClick={() => void loadCategories()}
          disabled={listLoading}
        >
          Refresh
        </Button>
      </div>

      {listError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load categories</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {ownerError && !owner ? (
        <Alert variant="destructive">
          <AlertTitle>Wrong account type</AlertTitle>
          <AlertDescription>{ownerError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 pt-4 md:p-6">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-4 overflow-x-auto">
            <div className="relative min-w-56 w-[58%] max-w-2xl shrink-0">
              <Input
                id="category-catalog-search"
                placeholder="Search name, sort order, date…"
                className="h-9 w-full px-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search categories"
                disabled={!owner || listLoading}
              />
            </div>
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                disabled={!owner || listLoading}
              >
                Add category
              </Button>
              <Select
                value={sortField}
                onValueChange={(v) => setSortField(v as SortField)}
                disabled={!owner || listLoading}
              >
                <SelectTrigger
                  className="h-9 w-38 shrink-0 sm:w-40"
                  aria-label="Sort by field"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="sortOrder">Sort order</SelectItem>
                  <SelectItem value="date">Date created</SelectItem>
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
                  title="Ascending"
                  aria-label="Sort ascending"
                  disabled={!owner || listLoading}
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
                  title="Descending"
                  aria-label="Sort descending"
                  disabled={!owner || listLoading}
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
                disabled={!owner || listLoading}
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

          {listLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !listError && categories.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No categories yet</EmptyTitle>
                <EmptyDescription>
                  Add a category using the preset list (e.g. Pizza, Burgers).
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : !listError && categories.length > 0 && processed.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No categories match</EmptyTitle>
                <EmptyDescription>
                  Try another search term or refresh the list.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : listError ? (
            <Empty className="min-h-[160px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Categories unavailable</EmptyTitle>
                <EmptyDescription>
                  Use Refresh after fixing the issue above.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Sort order</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open menu items for category ${c.name}`}
                    onClick={() =>
                      router.push(
                        `/admin/product-categories/${businessId}/${c.id}`,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(
                          `/admin/product-categories/${businessId}/${c.id}`,
                        );
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{c.name}</span>
                        {c.imageUrl ? (
                          <span className="text-xs text-muted-foreground truncate">
                            {c.imageUrl}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{c.sortOrder}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {processed.map((c) => (
                <li key={c.id}>
                  <Card
                    className="h-full cursor-pointer shadow-none transition-colors hover:bg-accent/30"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open menu items for category ${c.name}`}
                    onClick={() =>
                      router.push(
                        `/admin/product-categories/${businessId}/${c.id}`,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(
                          `/admin/product-categories/${businessId}/${c.id}`,
                        );
                      }
                    }}
                  >
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/15 text-primary-foreground">
                          {initials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base leading-tight">
                          {c.name}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {c.imageUrl ?? "No image URL yet"}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 pt-0">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          Sort {c.sortOrder}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "MMM d, yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>Add category</DialogTitle>
              <DialogDescription>
                Pick one preset name. It is saved as the category name for this
                business.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {submitError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="preset-category">Category</Label>
                <Select
                  value={presetName || undefined}
                  onValueChange={setPresetName}
                  required
                >
                  <SelectTrigger id="preset-category" className="w-full">
                    <SelectValue placeholder="Choose a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_PRODUCT_CATEGORY_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !presetName}>
                {submitting ? "Saving…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
