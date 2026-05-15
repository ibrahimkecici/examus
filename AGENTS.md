# AGENTS.md

## Repo layout

Two separate packages — install and run independently:

| | Root (backend) | `frontend/` |
|---|---|---|
| Runtime | Express 5 + Prisma + PostgreSQL | Next.js 16.2.1 (App Router) |
| Module system | CommonJS (`require`) | ESM (TypeScript) |
| Install | `npm install` | `cd frontend && npm install` |
| Dev | `npm run dev` (`node index.js`) | `npm run dev` (`next dev`) |
| Lint | none | `npm run lint` (`eslint`) |
| Build | none | `npm run build` (`next build`) |

## Backend gotchas

### Dev server has NO watch mode
`npm run dev` runs `node index.js` — no nodemon, no auto-restart. Kill and restart manually after changes.

### Auth middleware is blanket, not per-route
`requireAuth` is applied as `app.use('/api', requireAuth)` in `index.js:37`. Routes mounted before this line (`/api/health`, `/api/auth/*`) are excluded; everything else under `/api` requires a valid JWT. Do NOT add per-route auth checks — use the blanket middleware or mount routes before the gate.

### Turkish alias routes
Three Turkish paths mirror English ones for frontend compatibility — they share the same router instances:
- `/api/derslikler` = `/api/classrooms`
- `/api/gozetmenler` = `/api/invigilators`
- `/api/sinavlar` = `/api/exams`

### Prisma singleton
PrismaClient is created once in `src/config/prisma.js` and imported everywhere directly. There is NO repository layer or dependency injection.

### Error handling convention
Services throw `Error` objects with a `.status` property (e.g. `err.status = 404`). The global `errorHandler.js` middleware extracts this. All responses use `{ success: true, data }` or `{ success: false, message }`.

### Route handler wrapping
All async route handlers MUST be wrapped with `asyncHandler()` from `src/utils/asyncHandler.js` — it forwards rejected promises to the error handler via `next(err)`.

### Test runner is Node.js built-in: `node --test`
NOT Jest, NOT Vitest, NOT Mocha. Tests use `node:assert/strict`. Test files are in `test/` with `.test.js` extension. Run with `npm test`.

### AI service: heuristic fallback
When `AI_PROVIDER=heuristic` or `AI_API_KEY` is empty, the system uses `heuristicInsight()` instead of calling an LLM. Tests only cover the heuristic path.

### Prisma commands
```
npm run prisma:generate   # prisma generate (after schema changes)
npm run prisma:migrate    # prisma migrate dev (creates/apply migrations)
npm run db:reset          # prisma migrate reset --force (wipes DB)
```

### No backend lint/typecheck
There is no lint or typecheck script for the backend (plain JS, not TypeScript).

## Frontend gotchas

### No client-side auth guard
There is NO Next.js middleware or page-level auth check. The frontend relies entirely on the backend returning 401 for unauthenticated requests. Pages do not redirect to `/login` — they just show errors from failed API calls. Do not add auth gates unless asked.

### API client is minimal
`src/lib/api.ts` uses native `fetch()` — NOT axios. Token is stored in `localStorage.examus_token` and sent as `Authorization: Bearer` header. For report downloads (PDF/XLSX), the token is passed as a `?token=` query parameter instead.

### Tailwind CSS v4
Uses `@tailwindcss/postcss` PostCSS plugin with CSS-based config in `globals.css` (`@theme` block). There is NO `tailwind.config.ts`. Do not create one or reference `tailwind.config` patterns from v3.

### ESLint 9 flat config
Next.js 16 uses ESLint 9 flat config (likely `eslint.config.mjs`). Do not create `.eslintrc.*` files.

### No UI or form libraries
The app uses plain React 19 + Tailwind v4 with no shadcn/ui, Radix, react-hook-form, or Redux. All components are hand-built with standard `<form>`, `<input>`, `<select>`, etc.

### Next.js 16 breaking changes
Next.js 16 may have API and convention differences from your training data. Check `node_modules/next/dist/docs/` before writing significant Next.js code. The frontend uses App Router (not Pages Router) and Turbopack.

## Setup order

1. Start PostgreSQL
2. Copy `.env.example` → `.env`, fill in `DATABASE_URL` and `JWT_SECRET`
3. `npm install` (root)
4. `npm run prisma:generate && npm run prisma:migrate`
5. `npm run dev` (root — starts backend on :5001)
6. `cd frontend && npm install && npm run dev` (starts frontend on :3000)
7. Visit `http://localhost:3000/login` → "İlk admin hesabını oluştur" to bootstrap

## Docs to know about

- `examus_gereksinim_dokumani.md` — full requirements document (Turkish)
- `docs/examus-v1-degisiklikleri.md` — v1 change log
- `README.md` — project overview and API listing
- `frontend/README.md` — frontend-specific instructions
