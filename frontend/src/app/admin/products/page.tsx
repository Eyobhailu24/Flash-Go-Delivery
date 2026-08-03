"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  catalogCategoryNameImageUrl,
  createCategoryNameCatalogMultipart,
  deleteCategoryNameCatalog,
  fetchCategoryNameCatalog,
  updateCategoryNameCatalogMultipart,
  type CategoryNameCatalog,
} from "@/lib/admin-catalog-api";
import { AuthApiError } from "@/lib/auth-api";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminProductsPage() {
  const [rows, setRows] = useState<CategoryNameCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<CategoryNameCatalog | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [imageInput, setImageInput] = useState<File | null>(null);
  const [removeImageInput, setRemoveImageInput] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCategoryNameCatalog({
        limit: 200,
        offset: 0,
      });
      setRows(data.categoryNames);
    } catch (e) {
      setRows([]);
      setError(
        e instanceof AuthApiError
          ? e.message
          : "Could not load category name catalog.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [query, rows]);

  const resetForm = () => {
    setNameInput("");
    setIsActiveInput(true);
    setImageInput(null);
    setRemoveImageInput(false);
    setFormError(null);
    setSubmitting(false);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (row: CategoryNameCatalog) => {
    setActiveRow(row);
    setNameInput(row.name);
    setIsActiveInput(row.isActive);
    setImageInput(null);
    setRemoveImageInput(false);
    setFormError(null);
    setSubmitting(false);
    setEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createCategoryNameCatalogMultipart({
        name: nameInput,
        isActive: isActiveInput,
        image: imageInput,
      });
      setCreateOpen(false);
      resetForm();
      await loadRows();
    } catch (e) {
      setFormError(
        e instanceof AuthApiError ? e.message : "Could not create category name.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRow) return;
    if (!nameInput.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateCategoryNameCatalogMultipart(activeRow.id, {
        name: nameInput,
        isActive: isActiveInput,
        image: imageInput,
        removeImage: removeImageInput,
      });
      setEditOpen(false);
      setActiveRow(null);
      resetForm();
      await loadRows();
    } catch (e) {
      setFormError(
        e instanceof AuthApiError ? e.message : "Could not update category name.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: CategoryNameCatalog) => {
    setDeletingId(row.id);
    try {
      await deleteCategoryNameCatalog(row.id);
      await loadRows();
    } catch (e) {
      setError(
        e instanceof AuthApiError ? e.message : "Could not delete category name.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Products catalog names
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage reusable category names used by business product categories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={openCreate}>Add category name</Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Catalog error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Category name catalog</CardTitle>
          <CardDescription>
            These names are shared across businesses and selected in category dropdowns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search category names..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
            aria-label="Search category names"
          />

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"> </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="w-14 p-2">
                      {catalogCategoryNameImageUrl(row.imagePath) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            catalogCategoryNameImageUrl(row.imagePath) ?? undefined
                          }
                          alt={row.name}
                          className="size-10 rounded-md object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                          —
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? "default" : "secondary"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(row.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No category names found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent showCloseButton>
          <form onSubmit={(e) => void handleCreate(e)}>
            <DialogHeader>
              <DialogTitle>Add category name</DialogTitle>
              <DialogDescription>
                Create a reusable category name (for example: Drinks).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Drinks"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-image">Image (optional)</Label>
                <Input
                  id="create-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="cursor-pointer"
                  onChange={(e) =>
                    setImageInput(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="create-active"
                  checked={isActiveInput}
                  onCheckedChange={(v) => setIsActiveInput(v === true)}
                />
                <Label htmlFor="create-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setActiveRow(null);
            resetForm();
          }
        }}
      >
        <DialogContent showCloseButton>
          <form onSubmit={(e) => void handleEdit(e)}>
            <DialogHeader>
              <DialogTitle>Edit category name</DialogTitle>
              <DialogDescription>
                Update label or active status.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image">Replace image (optional)</Label>
                <Input
                  id="edit-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="cursor-pointer"
                  onChange={(e) =>
                    setImageInput(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-remove-image"
                  checked={removeImageInput}
                  onCheckedChange={(v) => setRemoveImageInput(v === true)}
                />
                <Label htmlFor="edit-remove-image" className="cursor-pointer">
                  Remove current image
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-active"
                  checked={isActiveInput}
                  onCheckedChange={(v) => setIsActiveInput(v === true)}
                />
                <Label htmlFor="edit-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !activeRow}>
                {submitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
