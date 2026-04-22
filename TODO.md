# FeroxStats — Codebase Review

> Items marked ~~strikethrough~~ have been fixed. Remaining items are still open.

---

## 🔒 Security

| Severity | Location | Issue | Status |
|----------|----------|-------|--------|
| 🟡 Med | `app/api/admin/gamemode/route.ts`, `app/api/admin/toggle-admin/route.ts`, `app/api/admin/unclaim/route.ts` | Admin routes use `NEXT_PUBLIC_SUPABASE_ANON_KEY` with cookie auth — operations constrained by RLS. If RLS lacks admin-specific policies, writes may silently fail. Consider using service role key. | Open |
| 🟡 Med | `app/api/admin/*.ts` | `getAdminClient()` helper duplicated across all 3 admin routes — should be shared in `lib/` | Open |
| 🟡 Med | `app/api/compare/route.ts`, `app/api/cron/update-players/route.ts`, `app/api/player/[username]/route.ts`, `app/api/ge/route.ts` | No timeout on external `fetch()` calls to Ferox API — requests could hang indefinitely | Open |
| 🟡 Med | `app/api/leaderboard/route.ts` | Uses `createServerClient` with anon key instead of importing `serviceClient` from `lib/supabase-service.ts` — inconsistent with other data-fetching routes | Open |
| ~~🔴 High~~ | ~~All API routes~~ | ~~No rate limiting on public endpoints~~ | ✅ Fixed — rate limiting added to `/api/search` (30/min), `/api/hiscores` (30/min), `/api/compare` (15/min), `/api/top-gains` (20/min) |
| ~~🔴 High~~ | ~~`app/api/search/route.ts`~~ | ~~Search `q` param has no max-length validation~~ | ✅ Fixed — max 100 chars enforced |
| ~~🟡 Med~~ | ~~`app/api/gamemode/route.ts`~~ | ~~No enum validation on game mode~~ | ✅ Fixed — uses `VALID_MODES.has()` check |
| ~~🟡 Med~~ | ~~`app/api/cron/update-players/route.ts`~~ | ~~Basic string comparison for cron auth~~ | ✅ Fixed — uses `timingSafeEqual` with Bearer token |
| ~~🟢 Low~~ | ~~`app/api/groups/[slug]/competitions/route.ts`~~ | ~~No check that competition dates are in the future~~ | ✅ Fixed — validates `startsAt.getTime() < Date.now()` |

---

## ⚡ Performance

| Severity | Location | Issue | Status |
|----------|----------|-------|--------|
| 🚨 Critical | `app/api/cron/update-players/route.ts` | N+1 query — 2 DB calls per player (upsert + snapshot insert) inside a loop. Stale players still cause 2 queries each. Batch with window functions or bulk insert. | Open |
| 🟡 Med | `app/api/leaderboard/route.ts`, `app/api/hiscores/route.ts`, `app/api/competitions/route.ts` | No `Cache-Control` header — expensive queries should return cache headers. Only `/api/top-gains` currently has `Cache-Control`. | Open |
| 🟡 Med | `app/groups/[slug]/GroupPageClient.tsx` | Creates `createClient()` inside `useEffect` on every mount — should be module-level or `useMemo` | Open |
| 🟡 Med | `app/groups/GroupsClient.tsx` | Creates `createBrowserClient()` inside `useEffect` instead of using `createClient` from `lib/supabase.ts` — inconsistent and creates a new instance each mount | Open |
| 🟢 Low | `app/compare/CompareClient.tsx` | Missing `useMemo` on skill-diff calculations in `SKILLS.map()` — recalculates 24 items every render | Open |
| ~~🔴 High~~ | ~~`app/api/cron/update-players/route.ts`~~ | ~~Updates ALL players every run~~ | ✅ Fixed — skips players updated within last 30 minutes |
| ~~🟡 Med~~ | ~~`app/player/[username]/PlayerPageClient.tsx`~~ | ~~Chart.js loaded synchronously~~ | ✅ Fixed — uses `lazy()` import for react-chartjs-2 components |
| ~~🟡 Med~~ | ~~`components/Navbar.tsx`~~ | ~~`onAuthStateChange` subscription re-created on re-renders~~ | ✅ Fixed — `useMemo` for client creation, proper cleanup |

---

## 🐛 Bugs & Logic Errors

| Severity | Location | Issue | Status |
|----------|----------|-------|--------|
| 🟡 Med | `app/api/competitions/[id]/route.ts`, `app/api/player/[username]/groups/route.ts`, `app/api/groups/[slug]/competitions/[compId]/route.ts` | `skillNames.indexOf(metric)` returns `-1` if skill not found — silently treated as skill 0 (overall) instead of erroring. `isValidSkill()` exists in `lib/api-utils.ts` but is unused by these routes. | Open |
| 🟢 Low | Multiple API routes | Inconsistent error format — `app/api/leaderboard/route.ts` uses `error.message ?? JSON.stringify(error)`, `app/api/status/route.ts` uses `String(error)`, others use `error.message`. Should standardize. | Open |
| ~~🔴 High~~ | ~~`app/api/groups/[slug]/requests/[requestId]/route.ts`~~ | ~~Race condition on member insert~~ | ✅ Fixed — uses `upsert` with `ignoreDuplicates: true` |
| ~~🟡 Med~~ | ~~`app/api/groups/[slug]/leaderboard/route.ts`~~ | ~~`skillNames.indexOf` returns -1 without error~~ | ✅ Fixed — checks `if (skillId === -1)` and returns 400 |

---

## ✨ UX / QOL Improvements

| Priority | Location | Suggestion | Status |
|----------|----------|------------|--------|
| 🔴 High | `components/HomeClient.tsx` | Stats fetch sets `statsError` state on failure but no error message is rendered — user sees empty stats with no explanation | Open |
| 🔴 High | `app/groups/[slug]/GroupPageClient.tsx` | No member search/filter — groups with 50+ members are hard to navigate | Open |
| 🔴 High | `app/compare/CompareClient.tsx` | No loading skeleton — table disappears while loading. Show shimmer placeholders. | Open |
| 🟡 Med | `components/Navbar.tsx` | Search box could show recent searches on focus | Open |
| 🟡 Med | `app/top-gains/TopGainsClient.tsx` | No XP/hour metric — can't distinguish fast grinders from slow accumulation | Open |
| 🟡 Med | `app/ge/GEClient.tsx` | No visual indicator that table is scrollable (scroll shadow) | Open |
| 🟡 Med | `app/auth/register/RegisterClient.tsx` | No password strength indicator | Open |
| 🟢 Low | `app/ge/item/[slug]/ItemPageClient.tsx` | If item history is empty, shows skeleton forever — needs "No data" state | Open |
| 🟢 Low | `app/status/StatusClient.tsx` | Refresh button has no success/failure confirmation | Open |

---

## ♿ Accessibility

| Severity | Location | Issue | Status |
|----------|----------|-------|--------|
| 🟡 Med | `components/Navbar.tsx` | Search suggestions dropdown missing `role="listbox"`, `role="option"`, `aria-selected`, `aria-activedescendant` | Open |
| 🟡 Med | `app/ge/GEClient.tsx` | Transaction table rows use `onClick` divs — not keyboard accessible. Use `<button>` or add `role="button"` + `tabindex="0"` + keydown handler. | Open |
| 🟡 Med | `components/Footer.tsx` | Body text color `text-[hsl(220_20%_64%)]` on `bg-[hsl(220_23%_8%)]` — verify contrast ratio meets WCAG AA 4.5:1 | Open |
| 🟢 Low | `app/competitions/[id]/CompetitionDetailClient.tsx` | Medal emojis (🥇🥈🥉) lack `aria-label` — screen readers can't convey meaning | Open |
| ~~🟢 Low~~ | ~~`components/Sidebar.tsx`~~ | ~~External link icon SVG missing `aria-hidden="true"`~~ | ✅ Fixed |

---

## 🧹 Code Quality

| Area | Location | Issue | Status |
|------|----------|-------|--------|
| Duplicated utility | `app/api/competitions/route.ts`, `app/api/competitions/[id]/route.ts`, `app/api/status/route.ts`, `app/api/player/[username]/groups/route.ts` | Each defines a local `serviceClient()` instead of importing from `lib/supabase-service.ts` | Open |
| Duplicated utility | `app/api/admin/gamemode/route.ts`, `app/api/admin/toggle-admin/route.ts`, `app/api/admin/unclaim/route.ts` | Each defines identical `getAdminClient()` — should be shared in `lib/` | Open |
| State bloat | `app/groups/[slug]/GroupPageClient.tsx` | **28** `useState` hooks — should use `useReducer` or group related state | Open |
| Inconsistency | `app/groups/GroupsClient.tsx` | Imports `createBrowserClient` directly from `@supabase/ssr` instead of using `createClient` from `lib/supabase.ts` | Open |
| Inconsistency | Server-side routes | Mix of `createClient` (supabase-js), `createServerClient` (ssr), and `serviceClient` (lib) — no clear pattern for which to use when | Open |
| Unused utility | `lib/api-utils.ts` | `isValidSkill()` and `SKILL_NAMES` exist but 3 routes still define local `skillNames` arrays instead of using them | Open |

---

## 💡 New Feature Ideas

- [ ] **Player watchlist** — follow players and get notified of level-ups or gains
- [ ] **Price alerts on GE items** — "alert me when X drops below Y"
- [ ] **Export/share competition standings** — clipboard, image, or CSV
- [ ] **Group milestone notifications** — toast when a milestone is achieved
- [ ] **Dark/light theme toggle** — currently locked to dark
- [ ] **API documentation page** — `/docs` with OpenAPI or similar
