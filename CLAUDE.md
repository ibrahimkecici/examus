# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Examus** is a university exam scheduling and optimization system. It consists of two independent packages:

| | Root (backend) | `frontend/` |
|---|---|---|
| Runtime | Express 5 + Prisma + PostgreSQL | Next.js 16.2.1 (App Router) |
| Module system | CommonJS (`require`) | ESM (TypeScript) |
| Install | `npm install` | `cd frontend && npm install` |
| Dev | `npm run dev` (`node index.js`) | `cd frontend && npm run dev` |
| Test | `npm test` (`node --test`) | — |
| Lint | none (plain JS) | `cd frontend && npm run lint` |
| Build | none | `cd frontend && npm run build` |

## Setup

1. Start PostgreSQL
2. Copy `.env.example` → `.env`, fill in `DATABASE_URL` and `JWT_SECRET`
3. `npm install` (root)
4. `npm run prisma:generate && npm run prisma:migrate`
5. `npm run dev` (backend on :5001)
6. `cd frontend && npm install && npm run dev` (frontend on :3000)
7. Visit `http://localhost:3000/login` → "İlk admin hesabını oluştur" to bootstrap admin

### Prisma commands
```
npm run prisma:generate   # after schema changes
npm run prisma:migrate    # apply migrations
npm run db:reset          # wipe and recreate DB (destructive)
```

## Backend architecture

**Entry point**: `index.js` — mounts auth routes before the blanket auth middleware, then all other routes.

**Auth middleware**: `requireAuth` is applied as `app.use('/api', requireAuth)` at line 37. Routes mounted before this line (`/api/health`, `/api/auth/*`) are public. Do NOT add per-route auth checks — everything else is already protected.

**Planning engine**: `src/services/planningService.js` orchestrates 16 specialized modules in `src/services/planning/`:
- `roomAllocator.js` — assigns classrooms to exams
- `seatAllocator.js` — assigns individual seats to students
- `invigilatorAllocator.js` — assigns proctors
- `validationService.js` — conflict detection
- `scenarioScorer.js` — quality scoring
- And 11 more specialized modules

**Database access**: Prisma singleton from `src/config/prisma.js`, imported directly everywhere — no repository layer, no dependency injection.

**Error handling convention**:
- Services throw `Error` objects with a `.status` property (e.g. `err.status = 404`)
- `errorHandler.js` middleware extracts `.status`
- All responses: `{ success: true, data }` or `{ success: false, message }`

**Async route handlers**: Always wrap with `asyncHandler()` from `src/utils/asyncHandler.js` — it forwards rejections to the error handler via `next(err)`.

**Turkish alias routes** (share same router instances as English paths):
- `/api/derslikler` = `/api/classrooms`
- `/api/gozetmenler` = `/api/invigilators`
- `/api/sinavlar` = `/api/exams`

**Dev server has NO watch mode** — `npm run dev` runs `node index.js` directly. Kill and restart manually after backend changes.

## Frontend architecture

**Routing**: Next.js App Router with Turkish page names (`/ogrenciler`, `/dersler`, `/derslikler`, `/gozetmenler`, `/donemler`, `/sinavlar`, `/planlama`, `/veri-yukleme`, `/raporlar`).

**API client**: `src/lib/api.ts` uses native `fetch()` — not axios. Token stored in `localStorage.examus_token`, sent as `Authorization: Bearer`. For report downloads (PDF/XLSX), token is passed as `?token=` query param.

**No client-side auth guard**: Pages do not redirect to `/login` — the app relies on backend 401 responses. Do not add auth gates unless explicitly asked.

**Tailwind CSS v4**: Uses `@tailwindcss/postcss` PostCSS plugin with CSS-based config in `globals.css` (`@theme` block). There is NO `tailwind.config.ts` — do not create one.

**ESLint 9 flat config**: Config is in `eslint.config.mjs`. Do not create `.eslintrc.*` files.

**No UI libraries**: Plain React 19 + Tailwind v4 — no shadcn/ui, Radix, react-hook-form, or Redux. All components use standard HTML form elements.

**Next.js 16 breaking changes**: APIs and conventions may differ from training data. Check `node_modules/next/dist/docs/` before writing significant Next.js code. Uses App Router and Turbopack.

## Testing

**Framework**: Node.js built-in `node:test` with `node:assert/strict` — NOT Jest, Vitest, or Mocha.

Test files are in `test/` with `.test.js` extension. Run all tests with `npm test`. Run a single file with `node --test test/<filename>.test.js`.

Tests only cover the heuristic AI path (not LLM calls). When `AI_PROVIDER=heuristic` or `AI_API_KEY` is empty, `heuristicInsight()` is used instead of an LLM.

## Key documentation

- `examus_gereksinim_dokumani.md` — full requirements document (Turkish)
- `docs/examus-v1-degisiklikleri.md` — v1 changelog
- `README.md` — project overview and full API endpoint listing
