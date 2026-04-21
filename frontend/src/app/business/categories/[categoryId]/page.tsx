"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  catalogItemImageUrl,
  createCategoryItemMultipart,
  deleteCategoryItem,
  fetchCategoryItems,
  fetchProductCategoryById,
  updateCategoryItemMultipart,
  type CategoryItem,
  type ProductCategory,
} from "@/lib/admin-catalog-api";
import { AuthApiError } from "@/lib/auth-api";
import {
  discountLabel,
  formatBirr,
  formatDiscountedBirr,
  hasDiscount,
} from "@/lib/currency";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BusinessCategoryItemsPage() {
  const params = useParams();
  const { user } = useAuth();
  const categoryIdRaw = params.categoryId;
  const categoryId =
    typeof categoryIdRaw === "string"
      ? categoryIdRaw
      : Array.isArray(categoryIdRaw)
        ? categoryIdRaw[0]
        : "";
  const idValid = UUID_RE.test(categoryId);

  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<CategoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [formAvailable, setFormAvailable] = useState(true);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    if (!idValid) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchCategoryItems({
        categoryId,
        limit: 200,
        offset: 0,
      });
      setItems(data.items);
    } catch (e) {
      setItems([]);
      setListError(
        e instanceof AuthApiError ? e.message : "Could not load items.",
      );
    } finally {
      setListLoading(false);
    }
  }, [categoryId, idValid]);

  useEffect(() => {
    if (!idValid || !user?.id) return;
    let cancelled = false;
    setCategoryError(null);
    void (async () => {
      try {
        const cat = await fetchProductCategoryById(categoryId);
        if (cancelled) return;
        if (cat.businessId !== user.id) {
          setCategory(null);
          setCategoryError("This category does not belong to your business.");
          return;
        }
        setCategory(cat);
      } catch (e) {
        if (cancelled) return;
        setCategory(null);
        setCategoryError(
          e instanceof AuthApiError ? e.message : "Could not load category.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, idValid, user?.id]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormDiscount("");
    setFormAvailable(true);
    setFormImage(null);
    setSubmitError(null);
  }

  function openEdit(it: CategoryItem) {
    setEditItem(it);
    setFormName(it.name);
    setFormDescription(it.description ?? "");
    setFormPrice(it.price);
    setFormDiscount(it.discount ?? "");
    setFormAvailable(it.isAvailable);
    setFormImage(null);
    setSubmitError(null);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!idValid) return;
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
    if (dTrim === "") discount = undefined;
    else {
      const d = Number.parseFloat(dTrim);
      if (!Number.isFinite(d) || d < 0) {
        setSubmitError("Invalid discount.");
        return;
      }
      discount = d;
    }
    setSubmitting(true);
    setSubmitError(null);
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
      setAddOpen(false);
      resetForm();
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError ? err.message : "Could not create item.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
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
    if (dTrim === "") discount = null;
    else {
      const d = Number.parseFloat(dTrim);
      if (!Number.isFinite(d) || d < 0) {
        setSubmitError("Invalid discount.");
        return;
      }
      discount = d;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateCategoryItemMultipart(editItem.id, {
        name,
        description: formDescription.trim() || null,
        price,
        discount,
        isAvailable: formAvailable,
        image: formImage ?? undefined,
      });
      await loadItems();
      setEditItem(null);
      resetForm();
    } catch (err) {
      setSubmitError(
        err instanceof AuthApiError ? err.message : "Could not update item.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteCategoryItem(deleteId);
      await loadItems();
      setDeleteId(null);
    } catch {
      /* */
    } finally {
      setDeleting(false);
    }
  }

  if (!idValid) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Invalid link</AlertTitle>
        <AlertDescription>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link href="/business/categories">Back to categories</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ready = Boolean(category && !categoryError);

  return (
    <main className="flex w-full flex-col gap-6">
      <Button variant="link" className="h-auto w-fit justify-start p-0 text-orange-700" asChild>
        <Link href="/business/categories">
          <ArrowLeft className="mr-1 size-4" />
          All categories
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {category?.categoryName.name ?? "Category items"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Add, edit, or remove dishes for this category.
        </p>
      </div>

      {categoryError ? (
        <Alert variant="destructive">
          <AlertTitle>Category</AlertTitle>
          <AlertDescription>{categoryError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl border-none shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Menu items</CardTitle>
            <CardDescription>
              {listLoading ? "Loading…" : `${items.length} items`}
            </CardDescription>
          </div>
          <Button
            type="button"
            className="rounded-xl bg-orange-500 text-white hover:bg-orange-400"
            disabled={!ready || listLoading}
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          {listError ? (
            <Alert variant="destructive">
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl bg-orange-100/50" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items yet. Add your first dish.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14" />
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const img = catalogItemImageUrl(it.imagePath);
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="size-10 rounded-lg object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-xs">
                            —
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{it.name}</div>
                        {it.description ? (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {it.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {hasDiscount(it.discount) ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground line-through">
                              {formatBirr(it.price)}
                            </span>{" "}
                            <span className="font-semibold text-orange-600">
                              {formatDiscountedBirr(it.price, it.discount)}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {discountLabel(it.discount)}
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium">{formatBirr(it.price)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="rounded-lg"
                          onClick={() => openEdit(it)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(it.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ItemFormDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetForm();
        }}
        title="Add item"
        description="Name and price are required. Image is optional."
        formName={formName}
        setFormName={setFormName}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formPrice={formPrice}
        setFormPrice={setFormPrice}
        formDiscount={formDiscount}
        setFormDiscount={setFormDiscount}
        formAvailable={formAvailable}
        setFormAvailable={setFormAvailable}
        formImage={formImage}
        onFileChange={(f) => setFormImage(f)}
        submitError={submitError}
        submitting={submitting}
        onSubmit={submitAdd}
      />

      <ItemFormDialog
        open={editItem != null}
        onOpenChange={(o) => {
          if (!o) {
            setEditItem(null);
            resetForm();
          }
        }}
        title="Edit item"
        description="Update fields and optionally replace the image."
        formName={formName}
        setFormName={setFormName}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formPrice={formPrice}
        setFormPrice={setFormPrice}
        formDiscount={formDiscount}
        setFormDiscount={setFormDiscount}
        formAvailable={formAvailable}
        setFormAvailable={setFormAvailable}
        formImage={formImage}
        onFileChange={(f) => setFormImage(f)}
        submitError={submitError}
        submitting={submitting}
        onSubmit={submitEdit}
      />

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers will no longer see it on your menu.
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

function ItemFormDialog({
  open,
  onOpenChange,
  title,
  description,
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formPrice,
  setFormPrice,
  formDiscount,
  setFormDiscount,
  formAvailable,
  setFormAvailable,
  formImage,
  onFileChange,
  submitError,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formPrice: string;
  setFormPrice: (v: string) => void;
  formDiscount: string;
  setFormDiscount: (v: string) => void;
  formAvailable: boolean;
  setFormAvailable: (v: boolean) => void;
  formImage: File | null;
  onFileChange: (f: File | null) => void;
  submitError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {submitError ? (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="it-name">Name</Label>
              <Input
                id="it-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-desc">Description</Label>
              <Input
                id="it-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="it-price">Price</Label>
                <Input
                  id="it-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="it-discount">Discount</Label>
                <Input
                  id="it-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="it-av"
                checked={formAvailable}
                onCheckedChange={(v) => setFormAvailable(v === true)}
              />
              <Label htmlFor="it-av" className="cursor-pointer">
                Available
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="it-img">Image (optional)</Label>
              <Input
                id="it-img"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="cursor-pointer rounded-xl"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
              {formImage ? (
                <p className="text-xs text-muted-foreground">New file selected</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-orange-500">
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
