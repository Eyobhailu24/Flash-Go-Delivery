import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminProductsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Catalog management will live here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Use the API routes under{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /catalog
            </code>{" "}
            for categories and menu items until this UI is built.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Business and admin roles can manage menus via the backend; a visual
          editor will be added in a follow-up.
        </CardContent>
      </Card>
    </div>
  );
}
