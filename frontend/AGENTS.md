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
