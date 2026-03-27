# Demoframe — Implementation Plan
## Phased Development Roadmap with Risk Assessments

**Document Version:** 1.0
**Last Updated:** 2026-03-27
**Target Duration:** 3 weeks (MVP)

---

## Overview
This plan breaks the MVP into 5 development runs. Each run combines related features to maximize build efficiency and minimize context switching. Phases are sequenced to unblock downstream work.

**Sequencing Logic:**
1. **Phases 1–2** can run in parallel if needed (extension capture + backend infra)
2. **Phases 3–5** are sequential (depend on prior phases)
3. **Phase 3** unblocks Phase 4 (dashboard allows linking to player)
4. **Phase 4** unblocks Phase 5 (need working player before gating/analytics)

---

## PHASE 1: Chrome Extension — Core Recording & Detection
**Duration:** 4–5 days
**Owner:** Extension architecture + rrweb integration
**Deliverables:** Working extension that records DOM events and detects interactive elements

### What gets built
- Chrome Extension (Manifest v3) scaffolding
- rrweb integration — start DOM event recording on user action
- Interactive element auto-detection — mark clickable elements during recording (buttons, links, inputs, etc.)
- Recording pause/stop UI in popup
- Export recording as JSON (local save first, before upload)
- Metadata capture — app URL, timestamp, user agent

### Combined work items
- **rrweb setup + element detection logic** — These are tightly coupled; auto-detection depends on rrweb's event stream. Build together.
- **Recording controls (start/stop/pause) + JSON export** — UI and serialization for same feature; one sprint.
- **Metadata + test harness** — Document all data captured; ship with test recording from a dummy app.

### Dependencies
- rrweb library must be vendored or bundled (CRX compatible)
- Chrome Extension permissions: `activeTab`, `scripting`, `webRequest`

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **rrweb bundle size in CRX** | Extension bloat; slow load | Medium | Use rrweb's minified bundle (~50kb); lazy-load replay features later |
| **DOM mutation accuracy in SPAs** — React/Vue re-render DOM between recordings | Recording misses updates | High | ✅ rrweb handles this; test on React + Vue sample apps day 1 |
| **Element detection false positives** — mark non-interactive divs as clickable | Confuses recording; noise | Medium | Whitelist common interactive tags (button, a, input); ignore divs unless they have click listeners |
| **Permission errors on restricted sites** — Gmail, GitHub gated by CSP | Extension fails silently | Low | Document unsupported sites; try/catch all scripting; fallback graceful error message |
| **Chrome Web Store review delay** — submit late, review takes 1–3 days | Blocks launch | Low | Submit to CWS by end of week 1; review in parallel with Phase 2 |

---

## PHASE 2: Backend Infrastructure & Database Schema
**Duration:** 3–4 days
**Owner:** Supabase setup + API scaffolding
**Deliverables:** Auth, Storage, and Postgres ready; upload endpoint working

### What gets built
- Supabase project setup (Auth, Storage, Postgres)
- Database schema:
  - `users` table (id, email, created_at, subscription_tier, recording_count)
  - `recordings` table (id, user_id, name, url, created_at, json_blob_path, metadata_json, view_count)
  - `recording_views` table (id, recording_id, viewer_ip, timestamp, interaction_data) — for analytics
- Authentication flow (email/magic link via Supabase Auth)
- Upload endpoint — authenticated route to write recording JSON to Supabase Storage
- Freemium validation — check recording count before upload
- Row-level security (RLS) policies — users can only access their own recordings

### Combined work items
- **Auth + user table** — Auth setup creates users; schema must exist. One transaction.
- **Upload endpoint + RLS policies** — Upload needs to enforce user ownership; RLS prevents cross-user access. Build together.
- **Recordings table + Storage path structure** — Decide naming (e.g., `/users/{user_id}/recordings/{recording_id}.json`); schema and storage logic align.

### Dependencies
- Supabase account active + API keys in `.env.local`
- Next.js backend route (API route for upload)
- Extension must have auth token to upload

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Auth token in extension context** — how to securely pass token from popup to content script | Security hole; XSS risk | High | ✅ Use Supabase's built-in browser session; store in extension local storage; validate on server |
| **RLS policy misconfiguration** — users access other users' recordings | Data leak; critical | Medium | Test RLS early; run as non-admin user; use Supabase Studio to verify policies |
| **Storage quota limits** — recording JSON grows; billing spike | Surprise cost | Low | Estimate: 500KB per recording; free tier allows 1GB; ~2000 recordings before upgrade needed |
| **Cold Postgres boot** — first request slow | User experience | Low | Supabase shared tier has warm pools; acceptable for MVP |
| **Recording size edge case** — 30-min recording = 10MB+ JSON | Upload times out | Low | Set max recording size limit (e.g., 5min = ~2.5MB); document in extension UI |

---

## PHASE 3: Next.js Dashboard & Recording Management
**Duration:** 4–5 days
**Owner:** Dashboard UI + recording CRUD
**Deliverables:** Authenticated dashboard where users can view, preview, and manage their recordings

### What gets built
- Dashboard layout (sidebar nav, header, main content area)
- Recordings list — table/grid view showing all user's recordings with name, date, view count
- Recording detail page — preview rrweb playback inline; metadata display
- Actions: rename, delete, copy shareable link
- Billing/account page — show subscription tier, upgrade CTA, billing history (placeholder for Phase 5)
- Onboarding flow — first-time user sees quick start (install extension → make recording → share)
- Navigation & auth guard — redirect unauthenticated users to login

### Combined work items
- **List + detail views + CRUD routes** — All query the same `recordings` table; share data fetching logic. Build together.
- **Recording preview + rrweb player embed** — Player is rendered in detail page; connect early to validate Phase 4 work.
- **Auth guard + onboarding** — Both check user state; build as middleware/layout wrapper.
- **Shareable link generation + display** — Once recording is uploaded, generate short link (UUID + slug); display prominently on detail page.

### Dependencies
- Phase 1 complete (need actual recordings to preview)
- Phase 2 complete (Supabase + auth live)
- rrweb player library (build Phase 4 code alongside for testing)

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Recording playback lag** — rrweb replay stutters with large DOM trees | Poor UX | Medium | Test with 5–10min recordings; profile rrweb perf in DevTools; pre-load recordings before play |
| **List view doesn't scale** — load all recordings client-side | Slow for 100+ recordings | Low (MVP scale) | Paginate server-side (20 per page); add search/filter later |
| **Naming collisions** — "Untitled" × 10 | Confusing UX | Low | Auto-name recordings based on domain (e.g., "app.com — 2026-03-27"). Allow rename. |
| **Session expiry mid-session** — user logs out while viewing recording | Error; broken UX | Low | Redirect to login + show toast; preserve scroll position on return |
| **Slow image thumbnails** — no preview of what recording shows | Users can't browse recordings | Medium | Generate single-frame snapshot from first DOM state; cache in Supabase |

---

## PHASE 4: Embed Player & Shareable Links
**Duration:** 4–5 days
**Owner:** rrweb player + interactivity layer
**Deliverables:** Lightweight embed player that visitors can interact with; one-line embed code

### What gets built
- Embed player — standalone HTML/JS bundle (~15kb gzipped)
  - rrweb player initialization from JSON
  - Click event interceptor — capture clicks, match to rrweb events, trigger replay response
  - Speed controls (play, pause, 0.5x, 1x, 2x)
  - Progress bar + timeline scrubbing
- Embed snippet generator — dashboard generates `<iframe>` code or script tag
- Shareable link page — hosted on Demoframe domain (e.g., `demoframe.io/demo/abc123`)
  - Minimal UI: player + "View source" link to dashboard
  - Mobile-responsive layout
  - Social meta tags (OG image, description)
- Player initialization data — minimal JSON payload (recording + metadata)
- Error handling — fallback if JSON fails to load

### Combined work items
- **rrweb player initialization + click handling** — Click handler depends on rrweb event stream; tightly coupled. One sprint.
- **Embed snippet generator + snippet types** — Generate both iframe and script tag variants from same template; one sprint.
- **Shareable link page + social meta tags** — Page structure and OG tags built together for SEO/sharing.
- **Speed controls + progress bar** — Both UI controls for same playback mechanism; shared state. One sprint.

### Dependencies
- Phase 1 (recording data format finalized)
- Phase 2 (storage + links available)
- Phase 3 (dashboard generates links)

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Cross-origin iframe restrictions** — embed fails on HTTPS → HTTP mixed content | Player broken | Medium | Ensure Demoframe host is HTTPS; document HTTPS requirement for embedded sites |
| **rrweb click replay inaccuracy** — visitor clicks don't map to original clicks | Core mechanic fails | High | ✅ rrweb's click event model is tested; validate with 3+ test apps; fallback: show raw replay without interactivity |
| **Player bundle bloat** — rrweb + controls + utilities > 15kb | Slow embed load | Medium | Lazy-load controls; async load rrweb; measure bundle size day 1 |
| **Time-dependent content freezes** — recording shows "2026-03-27 10:00" forever | Confusing UX | Low | Document limitation in embed; show "Recording made on [date]" disclaimer |
| **Missing interaction responses** — visitor clicks element, nothing happens (not recorded by founder) | Broken expectation | Medium | Highlight interactive elements during recording; guide founder to click each element; show guide in UI |

---

## PHASE 5: Monetization, Gating & Analytics
**Duration:** 3–4 days
**Owner:** Stripe integration + freemium enforcement
**Deliverables:** Subscription model live; free users limited to 3 recordings; Pro users (€19/mo) unlimited

### What gets built
- Freemium gating:
  - Check recording count on upload (free: ≤3 active, Pro: unlimited)
  - Return 402 Payment Required if limit exceeded; show upgrade CTA
  - Soft-delete + hard-delete logic (free users can delete to free up slots)
- Stripe integration:
  - Checkout flow (Stripe Billing or custom form)
  - Webhook handling — listen to `customer.subscription.created`, `customer.subscription.deleted`
  - Store subscription data in `users` table (`stripe_customer_id`, `subscription_tier`, `billing_period_end`)
- Analytics collection:
  - Log view events to `recording_views` table on player load
  - Track interaction completions (all clicks fired = 100% completion)
  - Dashboard: show basic stats (total views, completion %, last 7 days)
- Billing page:
  - Display current tier, next billing date
  - "Upgrade to Pro" CTA
  - "Manage subscription" link to Stripe portal
  - Invoice history (read from Stripe API)

### Combined work items
- **Freemium gate + recording count check** — Same logic; enforce at upload time.
- **Stripe webhook + subscription state management** — Webhooks update `users` table; both part of subscription flow. One sprint.
- **Analytics logging + dashboard stats** — Logging happens on embed; stats displayed on dashboard. Shared data source.
- **Billing page + Stripe portal link** — Billing page displays state + links to Stripe for management.

### Dependencies
- Phase 2 (Supabase auth + users table)
- Phase 3 (dashboard infrastructure)
- Phase 4 (player emits view events)
- Stripe account (test mode first)

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Webhook race condition** — user upgrades, counts old recording before subscription reflects | User sees wrong limit | Medium | Webhook handler increments `subscription_tier` immediately; idempotency key for retries |
| **Stripe test → production switch** — forget to flip API keys | Charges to test account, no revenue | Low | Use environment variables (`STRIPE_SECRET_KEY_PROD` vs. `_TEST`); staging env required |
| **Analytics explosion** — tracking every click fires DB write | Performance issue | Low | Batch analytics writes; use `recording_views` only for high-level completion; defer detailed analysis to V2 |
| **Free-tier gotcha** — user has 3 recordings, deletes 1, can't use because "soft deleted" | UX confusion | Medium | Auto-purge soft-deleted recordings after 7 days; show in dashboard with "Deleted" label + restore CTA |
| **Subscription downgrade mid-month** — Pro → Free with 10 recordings | How to enforce limit? | Low | Allow grace period (7 days) to delete excess; after that, oldest recordings become read-only |
| **Stripe billing errors** — failed charges, dunning cycles | Lost revenue; churn | Low | Use Stripe's built-in billing email; implement retry logic; notify user in dashboard if payment fails |

---

## Cross-Phase Dependencies & Ordering

```
Phase 1 (Extension) ────────────────┐
                                    ├─→ Phase 3 (Dashboard)
Phase 2 (Backend) ─────────────────┘
                                    ├─→ Phase 4 (Embed Player)
                                        │
                                        ├─→ Phase 5 (Monetization)
```

**Critical path:**
- Phase 2 must complete before Phase 3 (auth + storage needed)
- Phase 3 must complete before Phase 4 (generates links)
- Phase 4 must complete before Phase 5 (player emits analytics)
- Phases 1 & 2 can overlap (extension doesn't block backend work)

---

## Resource & Effort Estimates

| Phase | Estimated Duration | Notes |
|-------|-------------------|-------|
| Phase 1 | 4–5 days | Extension complexity depends on rrweb bundle & CSP issues |
| Phase 2 | 3–4 days | Supabase setup is straightforward; RLS policies take care |
| Phase 3 | 4–5 days | Dashboard is standard CRUD; preview player integration adds complexity |
| Phase 4 | 4–5 days | rrweb player straightforward; click replay requires testing |
| Phase 5 | 3–4 days | Stripe integration is well-documented; gating logic straightforward |
| **Total** | **19–23 days** | **Fits 3-week MVP window with slack** |

---

## MVP Launch Criteria

Before marking MVP "done," verify:

- [ ] Extension records & uploads at least one real demo (end-to-end test)
- [ ] Dashboard loads recording; preview works
- [ ] Embed player plays recording; clicks trigger responses
- [ ] Free user can upload 3 recordings; 4th blocked with upgrade CTA
- [ ] Upgrade to Pro works (Stripe test charge succeeds)
- [ ] Analytics logging works (at least view count tracking)
- [ ] No console errors on public demo link
- [ ] Chrome Web Store submission in review queue

---

## Post-MVP Backlog (V1.1 & V2)

These are *not* part of MVP but planned for later:

- **Manual element marking UI** — allow founder to click elements in recording preview to override auto-detection
- **Custom branding** — remove Demoframe badge for Pro users
- **Lead capture form** — embed form inside player for email collection
- **Multiple recordings per demo** — sequence demos (intro → feature 1 → feature 2)
- **Advanced analytics** — funnel tracking, drop-off heatmaps, session replay
- **Custom domain support** — Pro users can use custom.domain/demo instead of demoframe.io

---

## Testing Strategy

- **Phase 1:** Test extension on 3 sample apps (React, Vue, vanilla)
- **Phase 2:** RLS tests (cross-user access, permission errors)
- **Phase 3:** UI tests (list/detail navigation, auth flows)
- **Phase 4:** Player tests (playback accuracy, click replay, embed across domains)
- **Phase 5:** Stripe tests (checkout flow, webhook handling, subscription state)

**Integration test:** End-to-end recording → upload → embed → view → upgrade flow

---

## Known Risks (Summary)

**Critical (must mitigate before launch):**
1. rrweb compatibility with live apps — test day 1
2. RLS policies prevent data leaks — validate before Phase 3
3. Click replay accuracy — core mechanic viability

**High (likely to impact delivery):**
4. Chrome Web Store review timeline — submit early
5. Element detection false positives — refine heuristics
6. Recording playback performance — profile early

**Medium (manageable, document):**
7. Time-dependent content freezes — document limitation
8. Webhook race conditions — idempotency keys
9. Bundle size bloat — lazy-load features

---

## Success Handoff Criteria

**For each phase, move to next only if:**
- All deliverables complete
- Critical risks mitigated
- No blocking bugs
- Code committed + reviewed

**Final launch readiness:**
- Extension in Chrome Web Store (review in progress)
- Dashboard accessible at custom domain
- Embed player working on test site
- Stripe live key active
- Landing page published + ads ready to run

---

*This plan is a living document. Update as risks materialize or scope changes. Ship v1 with this structure; iterate on V1.1 based on real user feedback.*
