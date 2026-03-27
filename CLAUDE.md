# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Context

**Demoframe** is an interactive demo recorder for indie founders. Solo founder (Lars), pre-build stage. See `DemoFrame_PRD.md` and `IMPLEMENTATION_PLAN.md` for full context.

**Stack:** Chrome Extension (rrweb) · Next.js · Supabase · Stripe

**Status:** Pre-build (validation phase complete; build starts with Phase 1)

---

## Critical Constraint

**Only the following Supabase instance is authorized:**
```
https://yebjjmedmxrrzcjleeqp.supabase.co
```

All Supabase operations (Auth, Storage, Postgres) must target this instance. Verify `SUPABASE_URL` in `.env.local` and `.env.production` matches this URL before any deployment.

---

## Project Structure (To Be Built)

```
demoframe/
├── extension/                 # Chrome Extension (Manifest v3)
│   ├── manifest.json
│   ├── src/
│   │   ├── popup.html         # Recording controls UI
│   │   ├── popup.js
│   │   ├── content.js         # rrweb recorder + element detection
│   │   ├── background.js      # Extension service worker
│   │   └── utils/             # rrweb bundling, auth token handling
│   └── dist/                  # Built CRX (for Web Store)
│
├── dashboard/                 # Next.js app (dashboard + embed player)
│   ├── app/                   # App router structure
│   │   ├── (auth)/            # Auth flows (login, signup, callback)
│   │   ├── dashboard/         # Protected routes
│   │   │   ├── recordings/    # List + detail views
│   │   │   ├── billing/       # Subscription page
│   │   │   └── account/       # User settings
│   │   ├── embed/[id]/        # Shareable demo page (public)
│   │   └── api/               # Backend routes
│   │       ├── auth/          # Supabase Auth callbacks
│   │       ├── recordings/    # CRUD + upload handler
│   │       ├── webhooks/      # Stripe webhooks
│   │       └── analytics/     # View logging
│   ├── components/            # Reusable UI (player, forms, etc.)
│   ├── lib/                   # Supabase client, utils
│   ├── public/                # Static assets + embed snippet
│   └── package.json
│
├── embed-player/              # Standalone embed snippet (~15kb)
│   ├── src/
│   │   ├── player.ts          # rrweb player + click handling
│   │   ├── snippet.ts         # Embed code generator
│   │   └── index.ts
│   └── dist/                  # Built snippet (embedded in dashboard + CDN)
│
├── DemoFrame_PRD.md           # Product requirements
├── IMPLEMENTATION_PLAN.md     # Phased development plan
├── CLAUDE.md                  # This file
└── .env.local                 # Local development (Supabase keys, Stripe test)
```

---

## Development Phases & Commands

Commands will be added as each phase is built. Reference `IMPLEMENTATION_PLAN.md` for phase timing.

### Phase 1: Chrome Extension (Weeks 1)

**Setup:**
```bash
cd extension
npm install
```

**Build (during development):**
```bash
npm run build
# or watch mode
npm run dev
```

**Load in Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/dist/`

**Testing:**
```bash
npm test
# Test rrweb compatibility on sample apps
```

### Phase 2: Supabase & Backend (Week 1)

**Initialize Supabase locally (for testing):**
```bash
npm run supabase:init
npm run supabase:start
```

**Run migrations (after schema changes):**
```bash
npm run supabase:migrate
```

**Test Supabase Auth + RLS:**
```bash
npm run test:auth
npm run test:rls
```

### Phase 3–5: Dashboard, Player, Monetization

Commands will be added as development progresses.

**Next.js dev server (when ready):**
```bash
cd dashboard
npm run dev
# Opens http://localhost:3000
```

**Build for production:**
```bash
npm run build
npm start
```

---

## Architecture Decisions

### Why rrweb?
- Open source, battle-tested (LogRocket, Hotjar)
- Handles React/Vue/vanilla JS
- ~10k GitHub stars; maintained actively
- Returns pure JSON (no server needed for replay)

### Why Supabase?
- Auth out of the box (magic links, OAuth-ready)
- Storage for recording JSONs
- Postgres for user/recording metadata + analytics
- Row-level security (RLS) prevents cross-user access
- Cheap at MVP scale ($0–20/month)

### Why Next.js?
- Server-side rendering for dashboard
- API routes for Supabase interaction
- Vercel deployment (1-click deploy)
- Handles both dashboard + public embed page

### Recordings as Static JSON
- No server-side replay engine (cost-effective)
- Visitor clicks trigger rrweb events locally
- Embedding is a single `<iframe>` tag or `<script>`
- Scales infinitely (no backend load)

### Freemium Model
- Free: 3 active recordings (enforced on upload)
- Pro (€19/mo): unlimited recordings
- Gating logic in API route (check `users.subscription_tier`)

---

## Supabase Schema Overview (To Be Built)

### Tables

**users**
- `id` (UUID, PK)
- `email` (text)
- `created_at` (timestamp)
- `subscription_tier` (enum: 'free' | 'pro')
- `stripe_customer_id` (text, nullable)
- `recording_count` (int, auto-calculated)

**recordings**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `name` (text)
- `app_url` (text)
- `created_at` (timestamp)
- `json_blob_path` (text) — path in Storage (e.g., `/users/{user_id}/recordings/{id}.json`)
- `metadata_json` (jsonb) — interactive elements, user agent, etc.
- `view_count` (int)

**recording_views**
- `id` (UUID, PK)
- `recording_id` (UUID, FK → recordings)
- `viewer_ip` (text)
- `timestamp` (timestamp)
- `interaction_data` (jsonb) — which elements clicked, completion %

### RLS Policies
- `users` — own row only (cannot view other users)
- `recordings` — own recordings only (creator can read/update/delete)
- `recording_views` — creator can read analytics on their recordings

---

## Environment Variables

### `.env.local` (Development)

```env
# Supabase (fixed to authorized instance)
SUPABASE_URL=https://yebjjmedmxrrzcjleeqp.supabase.co
SUPABASE_ANON_KEY=<get from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>

# Stripe (test mode)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.env.production` (Deployment)

```env
SUPABASE_URL=https://yebjjmedmxrrzcjleeqp.supabase.co
SUPABASE_ANON_KEY=<prod key>
SUPABASE_SERVICE_ROLE_KEY=<prod key>

STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

NEXT_PUBLIC_APP_URL=https://demoframe.io
```

**Never commit secrets.** Use Vercel/Supabase dashboards to manage production keys.

---

## Key Files to Know

Once built, these files will be critical:

- **`extension/src/content.js`** — rrweb recorder + element detection logic (core of Extension)
- **`dashboard/lib/supabase.ts`** — Supabase client + auth helpers
- **`dashboard/app/api/recordings/upload/route.ts`** — Upload endpoint + freemium gating
- **`dashboard/components/Player.tsx`** — rrweb player initialization
- **`embed-player/src/player.ts`** — Standalone player for embeds

---

## Common Workflows (As They're Built)

### Recording a Demo
1. Founder visits their app
2. Clicks extension icon → "Start recording"
3. Performs interactions (clicks, form fills, etc.)
4. Clicks "Stop" → extension uploads JSON to Supabase
5. Sees recording in dashboard

### Embedding a Demo
1. Dashboard shows "Copy embed code"
2. Founder copies `<iframe src="demoframe.io/embed/abc123">`
3. Pastes on landing page
4. Visitors see interactive player

### Upgrading to Pro
1. Free user sees "Upgrade" prompt after 3rd recording
2. Clicks → Stripe checkout
3. Completes payment
4. `subscription_tier` updates to 'pro'
5. Upload now accepts unlimited recordings

---

## Testing Strategy

Once code exists, tests will focus on:

- **Extension:** rrweb recording accuracy on React/Vue/vanilla apps
- **Auth:** Supabase login flows, RLS enforcement
- **Upload:** Freemium gating (3 recordings for free users)
- **Player:** Click replay accuracy, embed cross-domain loading
- **Stripe:** Webhook handling, subscription state updates

End-to-end test: record → upload → embed → view → upgrade

---

## Deployment

### Extension
- Build locally
- Submit to Chrome Web Store (review: 1–3 days)
- Update manifest version for new releases

### Dashboard + Player
- Vercel deployment (connected to GitHub)
- Auto-deploy on push to `main` branch
- Environment secrets configured in Vercel dashboard

### Supabase
- Migrations run automatically with Vercel deploys
- Use `supabase migration new <name>` to create schema changes

---

## Important Notes

- **No backend recording engine** — only static rrweb replay. Recording accuracy depends entirely on rrweb's DOM event capture.
- **No real-time updates** — recordings are snapshots. If time-dependent content exists (e.g., "Created 2 min ago"), it will be frozen to recording time.
- **Single recording per demo** — V1 does not support sequencing (Part 1 → Part 2). One demo = one recording.
- **Manual element marking in V2** — V1 uses auto-detection only (based on clicks founder makes during recording). Allow override later.
- **Chrome extension only** — no Safari, no Firefox, no mobile in V1.

---

## References

- **[rrweb docs](https://github.com/rrweb-io/rrweb)** — Recording library; check for CSP/permissions issues
- **[Supabase docs](https://supabase.com/docs)** — Auth, Storage, Postgres; RLS policies
- **[Stripe Webhooks](https://stripe.com/docs/webhooks)** — Payment events (subscription created/updated/deleted)
- **[Chrome Extension Manifest v3](https://developer.chrome.com/docs/extensions/mv3/)** — Extension APIs, content scripts, permissions
- **[Next.js App Router](https://nextjs.org/docs/app)** — Dashboard framework

---

## Questions or Blockers?

Refer to:
1. `IMPLEMENTATION_PLAN.md` — phase sequencing, risks, dependencies
2. `DemoFrame_PRD.md` — product definition, scope boundaries
3. This file — architecture, setup, workflows

If a decision conflicts with PRD/plan, trust PRD first, then IMPLEMENTATION_PLAN, then ask.
