"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, RefreshCw, Sparkles, Table2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useAuth } from "@/contexts/auth-context";
import {
  catalogCategoryNameImageUrl,
  createProductCategory,
  deleteProductCategory,
  fetchCategoryNameCatalog,
  fetchProductCategories,
  type CategoryNameCatalog,
  type ProductCategory,
} from "@/lib/admin-catalog-api";
import { AuthApiError } from "@/lib/auth-api";

function filterCategories(list: ProductCategory[], q: string): ProductCategory[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((c) =>
    [c.categoryName.name, format(new Date(c.createdAt), "MMM d, yyyy")]
      .join(" ")
      .toLowerCase()
      .includes(s),
  );
}

export default function BusinessCategoriesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [names, setNames] = useState<CategoryNameCatalog[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNameId, setSelectedNameId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!user?.id) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchProductCategories(user.id, {
        limit: 200,
        offset: 0,
      });
      setCategories(data.categories);
    } catch (e) {
      setCategories([]);
      setListError(
        e instanceof AuthApiError ? e.message : "Could not load categories.",
      );
    } finally {
      setListLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCategoryNameCatalog({
          limit: 200,
          offset: 0,
          active: true,
        });
        if (!cancelled) setNames(data.categoryNames);
      } catch {
        if (!cancelled) setNames([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const processed = useMemo(
    () => filterCategories(categories, search),
    [categories, search],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNameId) {
      setSubmitError("Choose a catalog category (managed by FlashGo).");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createProductCategory({
        categoryNameId: selectedNameId,
      });
      await loadCategories();
      setModalOpen(false);
      setSelectedNameId("");
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError ? err.message : "Could not create category.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteProductCategory(deleteId);
      await loadCategories();
      setDeleteId(null);
    } catch {
      /* toast optional */
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="flex w-full flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-orange-100/80 bg-linear-to-br from-orange-50 via-white to-amber-50/40 p-6 shadow-md md:p-8">
        <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-orange-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-orange-700 shadow-sm ring-1 ring-orange-100">
              <Sparkles className="size-3.5" />
              Your menu structure
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              Categories
            </h1>
            <p className="max-w-xl text-sm text-gray-600">
              Link your business to catalog categories, then open each one to
              add dishes and prices. You cannot create new global category names
              — pick from the list FlashGo provides.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-orange-200 bg-white/90"
              disabled={listLoading}
              onClick={() => void loadCategories()}
            >
              <RefreshCw className={`mr-2 size-4 ${listLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              Add category
            </Button>
          </div>
        </div>
      </section>

      {listError ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle>Your categories</CardTitle>
            <CardDescription>
              {listLoading ? "Loading…" : `${processed.length} shown`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search…"
              className="h-9 w-44 rounded-xl sm:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant={view === "table" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setView("table")}
              aria-label="Table view"
            >
              <Table2 className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={view === "cards" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setView("cards")}
              aria-label="Card view"
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl bg-orange-100/50" />
              ))}
            </div>
          ) : processed.length === 0 ? (
            <Empty className="min-h-[180px] rounded-2xl border border-dashed border-orange-200/80">
              <EmptyHeader>
                <EmptyTitle>No categories yet</EmptyTitle>
                <EmptyDescription>
                  Add one by choosing a catalog name, then add menu items inside.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : view === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processed.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.categoryName.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mr-2 rounded-lg"
                        onClick={() =>
                          router.push(`/business/categories/${c.id}`)
                        }
                      >
                        Items
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {processed.map((c) => {
                const img = catalogCategoryNameImageUrl(c.categoryName.imagePath);
                return (
                  <li key={c.id}>
                    <Card className="overflow-hidden rounded-2xl border-orange-100/80 shadow-sm">
                      <div className="relative aspect-video w-full bg-orange-50/60">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                            {c.categoryName.name}
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{c.categoryName.name}</CardTitle>
                        <CardDescription>
                          {format(new Date(c.createdAt), "MMM d, yyyy")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        <Button asChild size="sm" className="rounded-lg bg-orange-500 text-white">
                          <Link href={`/business/categories/${c.id}`}>Manage items</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-lg text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          Delete
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={(e) => void handleCreate(e)}>
            <DialogHeader>
              <DialogTitle>Add category</DialogTitle>
              <DialogDescription>
                Select an existing catalog category. Ask FlashGo admin if you need
                a new type added.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {submitError ? (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label>Catalog category</Label>
                <Select
                  value={selectedNameId}
                  onValueChange={setSelectedNameId}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {names.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-orange-500">
                {submitting ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu items inside this category may become unreachable. This cannot
              be undone from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
