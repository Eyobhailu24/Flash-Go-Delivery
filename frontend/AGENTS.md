<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project stack (follow every time)

- **Backend:** [Hono](https://hono.dev/) — API and server logic live in the repo’s `backend/` app. Prefer calling it from the frontend via typed fetch or your existing API client pattern; do not assume Express/Nest unless you see it in code.
- **Frontend:** **Next.js** with **TypeScript** only — use `.ts` / `.tsx`, proper types for props and API responses, and App Router conventions already in this project (`src/app/`).
- **Monorepo mental model:** Frontend is this package; backend is separate — env vars, scripts, and dependencies are not shared unless explicitly wired (e.g. shared types package). Don’t mix Node server code into Next routes unless the codebase already does.

## UI components (follow every time)

- **Use shadcn/ui** for interactive UI — import from `@/components/ui/*` (Button, Card, Dialog, etc.). Compose and style with Tailwind to match existing pages.
- **Do not** add parallel UI kits (e.g. another full component library) or hand-roll primitives that already exist under `src/components/ui/` unless there is no shadcn equivalent and the team agrees.
- **New patterns:** If you need a composite widget (e.g. a form block), build it from shadcn primitives + Tailwind in `src/components/`, not duplicate low-level controls.
- **Providers:** Respect global providers already in `layout.tsx` (e.g. `TooltipProvider` for tooltips). Add new root providers only when needed and keep them in layout or a small providers file.

## General coding habits

- Match **existing** file structure, naming, and import aliases (`@/`).
- Prefer **small, focused changes**; avoid unrelated refactors in the same edit.
- When touching API behavior, verify against the **Hono** routes and types in `backend/`, not generic Node examples from training data.

## Backend API (Hono) — how we add features

Use this flow when adding or extending APIs; mirror what already exists in `backend/src/`.

1. **Controller** (`backend/src/controllers/*.controller.ts`)
   - Export async handlers that take Hono **`Context`**, parse input with **Zod**, use **Drizzle** (`db`, tables from `../schema.js`).
   - Return JSON with **`c.json(body, status)`**; errors use **`{ message: string }`** (same shape as `auth.controller.ts`).
   - List endpoints: support **`limit`** / **`offset`** query params where appropriate (cap `limit` server-side, e.g. max 200).

2. **Routes** (`backend/src/routes/*.routes.ts`)
   - Create a **`new Hono<Env>()`**; attach **`protect`** (cookie JWT) and **`restrictTo('admin')`** or **`restrictTo('business', 'admin')`** as needed.
   - For routes that need **`c.var.user`**, type **`Env`** with **`{ Variables: { user: AuthUser } }`** (see `auth.middleware.ts` + `catalog` / `user` routes).

3. **Mount in** `backend/src/index.ts`
   - **`app.route('/segment', yourRoutes)`** — keep CORS and cookie settings as-is.

4. **Auth**
   - Access token is the **`access_token` httpOnly cookie** (not Bearer-only for browser flows).
   - After **`protect`**, read the loaded user with **`c.var.user`** (Hono Variables).

5. **Migrations**
   - Change Drizzle models under `backend/src/models/`, then run **`drizzle-kit generate`** (or add SQL under `backend/drizzle/` and journal entries if you must hand-edit). Apply with the project’s migrate script.

## Frontend API + hooks — how we call the backend

1. **HTTP client** (`src/lib/auth-api.ts`)
   - Use **`authFetch(path, init)`** for all authenticated calls — it sets **`credentials: "include"`** so cookies are sent to **`NEXT_PUBLIC_API_URL`** (default `http://localhost:3001`).
   - Parse success JSON with **`readAuthJson<T>(response)`**; it throws **`AuthApiError`** with **`message`** when `!res.ok`.

2. **Feature hooks (any domain)** — e.g. `src/app/admin/_hooks/use-users.tsx`, future `use-orders.tsx`, `use-catalog.tsx`, etc.
   - File: **`use-<resource>.tsx`** next to the feature area that owns it (or under a shared `src/hooks/` if multiple areas need the same hook).
   - Start with **`"use client"`**; use **`useState` / `useCallback` / `useEffect`** (or a data library later) for loading, errors, and stable fetchers.

3. **Types (per resource)**
   - Export **TypeScript types** that mirror the **public** JSON your Hono handlers return (omit secrets and internal-only fields).
   - Name types after the **thing in the domain**: **`User`**, **`Order`**, **`CategoryItem`**, **`ProductCategory`**, etc. — not role- or page-specific names like `AdminUser` unless you truly have two different shapes for the same entity.
   - For request bodies, export **`CreateXInput`**, **`UpdateXInput`** (or **`PatchXInput`**) aligned with the backend Zod schemas.

4. **Two layers in the same module (recommended)**
   - **Layer A — thin HTTP helpers:** one **`async` function per endpoint** (or per verb), each doing **`authFetch` + `readAuthJson`**. Use clear names: **`fetchOrderById`**, **`postOrder`**, **`patchOrder`**, **`removeOrder`**, **`fetchCategories`**, etc. These are easy to import without the hook (e.g. server actions or one-off calls).
   - **Layer B — `use<Resource>` hook:** holds list (or main) state, **`loading`**, **`error`**, **`refetch`**, and **mutation methods** that call Layer A then **`refetch()`** (or update local state) so lists stay consistent.

5. **Naming collisions**
   - If the hook exposes **`createOrder`**, do **not** also export a top-level **`createOrder`** HTTP helper — rename the helper (**`postOrder`**, **`createOrderRequest`**, etc.) so imports are unambiguous.
   - Same idea for **`updateX`** / **`patchX`** and **`deleteX`** / **`removeX`**.

## Admin UI — established patterns

- **Shell:** `src/components/admin/admin-shell.tsx` — **shadcn `Sidebar`**, **`SidebarProvider`**, nav links, **`SidebarMenuToolbar`** (collapse: icon-only row shows only **`SidebarTrigger`**), **`SidebarFooter`** logout via **`useAuth().logout()`** + **`router.push('/login')`**.
- **Layout:** `src/app/admin/layout.tsx` wraps content with **`admin-dashboard`** class for the lighter orange theme (see **`src/app/globals.css`**).
- **Pages:** Under **`src/app/admin/`** — use shadcn **Card**, **Table**, **Input**, **Select**, **ToggleGroup**, etc.; load data with the matching feature hook (e.g. **`useUsers()`**) or the standalone fetch helpers when a hook is not needed.
- **Do not** add a duplicate global fetch client for the same API unless there is a strong reason; extend **`auth-api.ts`** or the feature hook instead.
