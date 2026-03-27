# Demoframe
## Product Requirements Document

**VERSION**
v0.1 — MVP

**OWNER**
Lars (solo founder)

**STATUS**
Pre-build

**STACK**
Chrome Ext (rrweb) · Next.js · Supabase

---

## 1. Problem
Indie founders and vibecoders want to show their product to potential users before it's ready for public access. The current options all fall short:

- Record a Loom — passive, not interactive, viewer stays passive
- Share a staging link — exposes real data, breaks unpredictably, requires setup
- Use Arcade or Supademo — screenshot-based, visitors know it's fake, feels cheap

No tool lets a founder say: 'just try it' — without friction, without a login, and without showing a slideshow of screenshots.

## 2. Solution
Demoframe records the exact interactions a founder performs on their live app using DOM event recording, then lets visitors replay and interact with those exact same interactions. It feels like a real app because it IS the real app — just playing back what the founder did.

**Core mechanic:**
- Founder installs Chrome extension
- Navigates their app + performs the interaction they want to showcase (drag a node, create an event, whatever)
- Extension records all DOM events and detects which elements are interactive
- Upload recording to Demoframe dashboard
- Gets a shareable link + one-line embed snippet
- Visitor sees the exact UI, can click the same elements, and triggers the recorded responses — no login, no server, fully static player

## 3. Target user

**PRIMARY**
Indie SaaS founder / vibecoder

Solo or small team. Builds in public. Wants to convert landing page visitors before the product is polished. Uses Claude Code, Vercel, Supabase. Price-sensitive — won't pay €500/mo for a sales tool.

**USE CASES**
- Embed live demo on landing page
- Send in cold outreach / waitlist emails
- Share in IndieHackers / X posts
- Investor deck — let them try, not just watch

## 4. MVP scope — what gets built

| Feature | Priority | MVP scope |
|---------|----------|-----------|
| Chrome extension — rrweb DOM event recording | Must | Week 1 |
| Interactive element auto-detection & marking | Must | Week 1 |
| Upload recording to Supabase Storage | Must | Week 1 |
| Dashboard — manage recordings, preview | Must | Week 2 |
| Embed player — rrweb replay + interactive click handling | Must | Week 2 |
| Shareable link + one-line embed snippet | Must | Week 2 |
| Auth (Supabase Auth) + user dashboard | Must | Week 3 |
| Freemium gate — max 3 recordings on free plan | Must | Week 3 |
| Stripe integration — €19/mo Pro plan | Must | Week 3 |
| Basic analytics — views + interaction completion | Must | Week 3 |
| Manual element marking override | Should | V2 |
| Custom branding / remove Demoframe badge | Should | V2 |
| Lead capture form inside replay | Should | V2 |
| Multiple recordings per page | Could | V2 |
| AI-generated interaction suggestions | Could | V3 |

## 5. Explicitly out of scope (v1)
- Video / screen recording — this is not Loom
- Team seats / multi-user orgs — solo founder tool
- CRM integrations — no HubSpot, Salesforce connectors
- Mobile app capture — browser extension only, desktop Chrome
- Multiple recordings per demo page — one interaction per demo
- Manual element marking UI — auto-detection only
- Live backend for custom interactions — recordings are static replays

## 6. Technical stack

**CAPTURE LAYER**
- Chrome Extension (Manifest v3)
- rrweb for DOM event recording (open source, battle-tested by LogRocket/Hotjar)
- Auto-detection of interactive elements based on click events
- Extension uploads recording JSON + metadata to Supabase Storage

**HOSTING / INFRA**
- Next.js on Vercel (dashboard + embed player)
- Supabase — Auth, Storage, Postgres (user/recording metadata)
- Stripe — subscription billing

**EMBED PLAYER**
- Lightweight JS snippet (~10kb)
- rrweb player for DOM replay
- Click event interceptor that triggers recorded interactions
- No external requests at runtime — fully static JSON playback

**KEY DEPENDENCY**
- rrweb (https://github.com/rrweb-io/rrweb)
- Open source, used by LogRocket and Hotjar for session recording
- Handles all UI frameworks (React, Vue, vanilla)
- Battle-tested with 10k+ GitHub stars

## 7. Pricing model

| Tier | Free | Pro — €19/mo |
|------|------|--------------|
| Price | €0 — no credit card | €19/mo, cancel anytime |
| Active demos | 3 | Unlimited |
| Views | Unlimited | Unlimited |
| Analytics | Basic (views) | Full (drop-off, completion) |
| Branding | Demoframe badge | Remove badge |
| Embed | iframe only | iframe + custom domain |

## 8. Risks & mitigations

- **rrweb compatibility** — rrweb handles 99% of UI frameworks; test early on customer apps; fallback: manual testing
- **Recording accuracy with SPAs** — rrweb captures DOM state after user actions; test with React/Vue/Svelte early
- **Time-dependent content** — timestamps in replay will be frozen to recording time; document in onboarding
- **Interactive element detection** — auto-detection based on clicks founder makes during recording; manual override in V2 if needed
- **Chrome extension distribution** — Chrome Web Store review takes 1–3 days; submit early
- **Differentiation vs. Supademo/LogRocket** — Supademo is screenshots, LogRocket is for debugging; we're for marketing demos; clear positioning

## 9. Validation plan (before full build)
Before spending 3 weeks building, validate demand with a fake-door test:

1. Build a landing page in 1 day (Next.js or Webflow)
2. Run €20–40 in X/Twitter ads targeting 'indie hacker', 'SaaS founder', 'build in public'
3. Measure: CTR on 'Get started free' button and waitlist signups
4. Target: 50+ signups or >3% CTR = green light to build
5. Post the demo of your own landing page built with the tool on IndieHackers + X as first marketing

## 10. Success metrics

| Metric | Target (month 1) | Target (month 3) |
|--------|------------------|------------------|
| Waitlist signups | 50+ | — |
| Active free users | — | 100+ |
| Paying users (Pro) | — | 10+ |
| MRR | €0 | €190+ |
| Demo completion rate | >50% of visitors | >50% of visitors |

---

This document is a living reference. Update it as decisions are made during build. Last priority: ship a working v1 — perfect PRD, imperfect product.
