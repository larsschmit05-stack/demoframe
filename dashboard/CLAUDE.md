# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

DemoFrame dashboard — a Next.js 14 (App Router) app that lets indie founders capture interactive clones of their web apps and embed them on landing pages. Visitors click through a pixel-perfect copy of the real app. Not a session replay tool — a static DOM snapshot viewer with screen-to-screen navigation.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build (also validates TypeScript)
npm run lint     # ESLint
npm start        # Run production server
```

No test runner is configured yet. Use `npx tsc --noEmit` for fast type-checking without a full build.

## Critical Constraint

All Supabase operations must target `https://yebjjmedmxrrzcjleeqp.supabase.co`. Verify env vars before any deployment.

## Architecture

### Three Supabase Clients

- **`lib/supabase/client.ts`** — Browser client (anon key). Used in client components for auth actions.
- **`lib/supabase/server.ts`** — Server component client (anon key, cookie-based sessions). Used in API routes and server components. RLS enforced.
- **`lib/supabase/service.ts`** — Service role client (bypasses RLS). Used only for: public embed API, analytics logging, extension screen uploads.

Choose the right client based on context. The service role client should only be used when RLS cannot apply (unauthenticated public routes, extension Bearer token uploads).

### Auth Flow

Middleware (`middleware.ts`) handles session refresh and route protection. Protected routes are under `/dashboard/*`. Public routes: `/embed/*`, `/api/embed/*`, `/api/analytics/log`.

The Chrome extension authenticates via Bearer token (access_token from Supabase session). The `ExtensionBridge` component in the dashboard layout sends the token to the extension via `window.postMessage`.

### Data Model

**demos** → **screens** (1:many) → **navigation_rules** (many, linking source_screen to target_screen via CSS selector triggers)

Screens are self-contained HTML files stored in Supabase Storage at `users/{user_id}/demos/{demo_id}/screens/{screen_id}.html`. All CSS, images, and fonts are inlined as data URIs during capture. Scripts are stripped (CSS-only interactivity for MVP).

RLS on screens and navigation_rules is gated through demo ownership: `EXISTS (SELECT 1 FROM demos WHERE demos.id = screens.demo_id AND demos.user_id = auth.uid())`.

### Embed Player (Shadow DOM)

The embed player (`components/embed/DemoPlayer.tsx`) renders captured screens inside a Shadow DOM for CSS encapsulation. It fetches all screen HTML via signed URLs, parses with DOMParser, and injects styles + body content into the shadow root. Navigation rules attach click handlers to trigger elements that swap the rendered screen.

`DemoPreview.tsx` is a simpler version (single screen, no navigation, all clicks blocked) used in the dashboard.

### Freemium Gating

Free tier: 3 active demos max. Checked via `get_active_demo_count` RPC in the POST `/api/demos` route. Constants in `lib/constants.ts`: `FREE_DEMO_LIMIT`, `MAX_SCREEN_SIZE_BYTES` (15MB), `MAX_SCREENS_PER_DEMO` (20).

### API Route Patterns

- **Dashboard routes** use `createClient()` (server) — session auth via cookies, RLS enforced
- **Extension upload** (`/api/demos/[id]/screens/upload`) uses Bearer token auth + service role client
- **Public routes** (`/api/embed/[id]`, `/api/analytics/log`) use service role client with CORS headers

### Legacy Code

`recordings`, `recording_views` tables and their API routes (`/api/recordings/*`, `/dashboard/recordings/*`) still exist from the pre-rearchitecture phase. New code should use `demos`/`screens`/`navigation_rules`. Legacy types in `lib/types.ts` are marked `@deprecated`.

## Conventions

- Path alias: `@/*` maps to project root
- Tailwind CSS for all styling — no CSS modules or styled-components
- Server components by default; add `'use client'` only when needed (state, effects, event handlers)
- Embed routes have permissive CSP headers (`frame-ancestors *`) set in `next.config.js`
- Supabase migrations live in `supabase/migrations/` and are applied to the live instance via Supabase MCP or CLI
