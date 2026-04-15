"use client";

import { format } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LayoutGridIcon,
  TableIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserById, type User } from "@/app/admin/_hooks/use-users";
import {
  catalogItemImageUrl,
  createCategoryItemMultipart,
  fetchCategoryItems,
  fetchProductCategoryById,
  type CategoryItem,
  type ProductCategory,
} from "@/lib/admin-catalog-api";
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
import { Checkbox } from "@/components/ui/checkbox";
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

const viewStorageKey = (categoryId: string) =>
  `admin-category-items-view:${categoryId}`;

type SortField = "name" | "price" | "sortOrder" | "date";
type SortDir = "asc" | "desc";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
}

function priceNum(p: string): number {
  return Number.parseFloat(p) || 0;
}

function filterItems(
  list: CategoryItem[],
  q: string,
): CategoryItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((it) => {
    const hay = [
      it.name,
      it.description ?? "",
      it.price,
      it.discount ?? "",
      String(it.sortOrder),
      it.isAvailable ? "available" : "unavailable",
      format(new Date(it.createdAt), "MMM d, yyyy"),
      it.createdAt,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(s);
  });
}

function sortItems(
  list: CategoryItem[],
  field: SortField,
  dir: SortDir,
): CategoryItem[] {
  const next = [...list];
  const cmpName = (a: CategoryItem, b: CategoryItem) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const cmpPrice = (a: CategoryItem, b: CategoryItem) =>
    priceNum(a.price) - priceNum(b.price);
  const cmpOrder = (a: CategoryItem, b: CategoryItem) =>
    a.sortOrder - b.sortOrder;
  const cmpDate = (a: CategoryItem, b: CategoryItem) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (field === "name") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpName(a, b) : cmpName(b, a),
    );
  }
  if (field === "price") {
    return next.sort((a, b) =>
      dir === "asc" ? cmpPrice(a, b) : cmpPrice(b, a),
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

export default function AdminCategoryItemsPage() {
  const params = useParams();
  const businessIdRaw = params.businessId;
  const categoryIdRaw = params.categoryId;
  const businessId =
    typeof businessIdRaw === "string"
      ? businessIdRaw
      : Array.isArray(businessIdRaw)
        ? businessIdRaw[0]
        : "";
  const categoryId =
    typeof categoryIdRaw === "string"
      ? categoryIdRaw
      : Array.isArray(categoryIdRaw)
        ? categoryIdRaw[0]
        : "";

  const idsValid =
    UUID_RE.test(businessId) && UUID_RE.test(categoryId);

  const [owner, setOwner] = useState<User | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [formAvailable, setFormAvailable] = useState(true);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    if (!idsValid) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchCategoryItems(categoryId, {
        limit: 100,
        offset: 0,
      });
      setItems(data.items);
    } catch (e) {
      setItems([]);
      setListError(
        e instanceof AuthApiError
          ? e.message
          : "Could not load items for this category.",
      );
    } finally {
      setListLoading(false);
    }
  }, [categoryId, idsValid]);

  useEffect(() => {
    if (!idsValid) return;
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
  }, [businessId, idsValid]);

  useEffect(() => {
    if (!idsValid) return;
    let cancelled = false;
    setCategoryError(null);
    void (async () => {
      try {
        const cat = await fetchProductCategoryById(categoryId);
        if (cancelled) return;
        if (cat.businessId !== businessId) {
          setCategory(null);
          setCategoryError(
            "This category does not belong to the selected business.",
          );
          return;
        }
        setCategory(cat);
      } catch (e) {
        if (cancelled) return;
        setCategory(null);
        setCategoryError(
          e instanceof AuthApiError
            ? e.message
            : "Could not load category.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, categoryId, idsValid]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!idsValid) return;
    const raw = window.localStorage.getItem(viewStorageKey(categoryId));
    if (raw === "table" || raw === "cards") {
      queueMicrotask(() => setViewMode(raw));
    }
  }, [categoryId, idsValid]);

  useEffect(() => {
    if (!idsValid || typeof window === "undefined") return;
    window.localStorage.setItem(viewStorageKey(categoryId), viewMode);
  }, [categoryId, idsValid, viewMode]);

  const processed = useMemo(() => {
    return sortItems(filterItems(items, search), sortField, sortDir);
  }, [items, search, sortField, sortDir]);

  const resetModal = () => {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormDiscount("");
    setFormAvailable(true);
    setFormImage(null);
    setSubmitError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) resetModal();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFormImage(f ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idsValid) return;
    const name = formName.trim();
    if (!name) {
      setSubmitError("Name is required.");
      return;
    }
    const price = Number.parseFloat(formPrice);
    if (!Number.isFinite(price) || price < 0) {
      setSubmitError("Enter a valid price.");
      return;
    }
    let discount: number | null | undefined;
    const dTrim = formDiscount.trim();
    if (dTrim === "") {
      discount = undefined;
    } else {
      const d = Number.parseFloat(dTrim);
      if (!Number.isFinite(d) || d < 0) {
        setSubmitError("Discount must be a valid non-negative number.");
        return;
      }
      discount = d;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      await createCategoryItemMultipart({
        categoryId,
        name,
        description: formDescription.trim() || undefined,
        price,
        discount,
        isAvailable: formAvailable,
        image: formImage,
      });
      await loadItems();
      setModalOpen(false);
      resetModal();
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError
          ? err.message
          : "Could not create item.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const ready = Boolean(owner && category && !categoryError);

  if (!idsValid) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <Alert variant="destructive">
          <AlertTitle>Invalid link</AlertTitle>
          <AlertDescription>
            <Link
              href="/admin/product-categories"
              className="font-medium underline underline-offset-4"
            >
              Back to businesses
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
            <Link href={`/admin/product-categories/${businessId}`}>
              ← Categories for this business
            </Link>
          </Button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {category ? category.name : "Category items"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {owner
              ? `${owner.fullName} · ${owner.email}`
              : ownerError ?? "Loading…"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and sort menu items. Add items with optional image upload
            (stored on the server).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:mt-0.5"
          onClick={() => void loadItems()}
          disabled={listLoading}
        >
          Refresh
        </Button>
      </div>

      {listError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load items</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {categoryError ? (
        <Alert variant="destructive">
          <AlertTitle>Category</AlertTitle>
          <AlertDescription>{categoryError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 pt-4 md:p-6">
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-4 overflow-x-auto">
            <div className="relative min-w-56 w-[58%] max-w-2xl shrink-0">
              <Input
                id="category-items-search"
                placeholder="Search name, description, price, availability…"
                className="h-9 w-full px-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search items"
                disabled={!ready || listLoading}
              />
            </div>
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                disabled={!ready || listLoading}
              >
                Add item
              </Button>
              <Select
                value={sortField}
                onValueChange={(v) => setSortField(v as SortField)}
                disabled={!ready || listLoading}
              >
                <SelectTrigger
                  className="h-9 w-38 shrink-0 sm:w-40"
                  aria-label="Sort by field"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
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
                  disabled={!ready || listLoading}
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
                  disabled={!ready || listLoading}
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
                disabled={!ready || listLoading}
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
          ) : !listError && items.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No items yet</EmptyTitle>
                <EmptyDescription>
                  Add a menu item with name, price, and optional image.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : !listError && items.length > 0 && processed.length === 0 ? (
            <Empty className="min-h-[200px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>No items match</EmptyTitle>
                <EmptyDescription>
                  Try another search term or refresh the list.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : listError ? (
            <Empty className="min-h-[160px] border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Items unavailable</EmptyTitle>
                <EmptyDescription>
                  Use Refresh after fixing the issue above.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"> </TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Price</TableHead>
                  <TableHead className="hidden md:table-cell">Discount</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.map((it) => {
                  const imgSrc = catalogItemImageUrl(it.imagePath);
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="w-14 p-2">
                        {imgSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgSrc}
                            alt=""
                            className="size-10 rounded-md object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{it.name}</span>
                          {it.description ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {it.description}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium">
                        ${it.price}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {it.discount != null ? `$${it.discount}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={it.isAvailable ? "default" : "secondary"}>
                          {it.isAvailable ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {format(new Date(it.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {processed.map((it) => {
                const imgSrc = catalogItemImageUrl(it.imagePath);
                return (
                  <li key={it.id}>
                    <Card className="h-full overflow-hidden shadow-none transition-colors hover:bg-accent/30">
                      <div className="relative aspect-4/3 w-full bg-muted">
                        {imgSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgSrc}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>
                      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="bg-primary/15 text-primary-foreground">
                            {initials(it.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base leading-tight">
                            {it.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {it.description ?? "No description"}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">${it.price}</Badge>
                          {it.discount != null ? (
                            <Badge variant="secondary">${it.discount} off</Badge>
                          ) : null}
                          <Badge
                            variant={it.isAvailable ? "default" : "secondary"}
                          >
                            {it.isAvailable ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(it.createdAt), "MMM d, yyyy")}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 p-0 sm:max-w-lg"
          showCloseButton
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex max-h-[min(90vh,720px)] flex-col"
          >
            <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
              <DialogTitle>Add item</DialogTitle>
              <DialogDescription>
                Name and price are required. Image is optional (JPEG, PNG,
                WebP, or GIF, max 5MB).
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              {submitError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="ci-name">Name</Label>
                <Input
                  id="ci-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci-desc">Description (optional)</Label>
                <Input
                  id="ci-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ci-price">Price</Label>
                  <Input
                    id="ci-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ci-discount">Discount (optional)</Label>
                  <Input
                    id="ci-discount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ci-available"
                  checked={formAvailable}
                  onCheckedChange={(v) => setFormAvailable(v === true)}
                />
                <Label htmlFor="ci-available" className="cursor-pointer">
                  Available
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci-image">Image (optional)</Label>
                <Input
                  id="ci-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="cursor-pointer"
                  onChange={handleFileChange}
                />
                {formImage ? (
                  <p className="text-sm text-muted-foreground">1 file added</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-muted/40 px-4 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
