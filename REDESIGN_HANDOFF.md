# MeowTarot Redesign — Handoff (2026-06-03)

Copy/paste the **PROMPT** block at the bottom into a fresh Claude Code
session. Everything above it is reference for the human reader.

---

## 1. What got done in Phase 5 (chronological, latest first)

| Commit | Title | Surface |
|---|---|---|
| `f8a7c35` | fix(profile): tighten spacing after bilingual rows dropped | Profile visual QA fix |
| `154a8fc` | fix(i18n): re-audit caught remaining bilingual emit leaks | Profile streak hero, reading-result card name/archetype/keyword |
| `e43a4d5` | feat(i18n): strip bilingual EN·TH pairs — EN site EN-only, TH site TH-only | Hard-strip across all EN entry points + JS emit paths |
| `d308f45` | feat(full): B1 — 12-card grid selection board | `full.html` rebuild, drops deal-orbit + arrange-list 2-stage UX |
| `28385ed` | feat(nav): C2 — 4-tab floating-pill bottom nav | Today / Decks / Ask / Profile + hand-crafted cat SVG icons |
| `e0c0959` | feat(nav): route bottom-nav Cards tab to `/decks.html` | Bottom-nav routing |
| `732d729` | feat(decks): standalone `/decks.html` Deck Inventory page | New page + decks.js + decks.css |
| `56ec009` | feat(popups): sign-in gate + streak-milestone modal popups | `js/sign-in-gate.js` + `js/streak-milestone.js` |
| `a31724c` | feat(shell): remove global top navbar | initShell stops calling renderNavbar |
| `f7a5b87` | feat(profile): add language toggle pill | Profile top-row EN/TH switch |
| `0e51192` | feat(ask): char counter + specificity hint on question input | `question.html` polish |
| `e019d2d` | feat(daily): shuffle button above selection board | `daily.html` + `daily.css` |
| `7137f12` | feat(design): phase 5 profile structural rebuild | Profile streak hero + progress + lifetime stats |
| `87d886c` | feat(design): phase 5 celtic cross result rebuild | renderFull + summary panel |
| `86fb5e8` | fix(reading): daily-mode result page rebuild | Single-card ceremonial layout |
| `ea5dab3` | feat(design): phase 5 reading result structural rebuild | renderQuestion Quick Pull + Story |
| `37b662b` | feat(design): phase 5 ask flow structural rebuild | `question.html` shape picker + topic chips |
| `2949000` | feat(design): phase 5 daily flow structural rebuild | `daily.html` 12-card grid + 1-pick |
| `4bd3b95` | feat(design): phase 5 homepage structural rebuild | `index.html` ceremonial hero + path cards |

### Phase 5 design-doc surface coverage

| § | Surface | Status |
|---|---|---|
| 1 | Homepage | ✓ shipped |
| 2 | Daily Before-Draw | removed per user direction |
| 3 | Daily card-selection board | ✓ shipped |
| 4 | Daily After (result) | ✓ shipped |
| 5 | Ask a Question flow | ✓ shipped |
| 6 | Quick Pull result | ✓ shipped |
| 7 | Story Spread result | ✓ shipped |
| 8 | Celtic Cross result | ✓ shipped |
| 9 | Profile · Streak & Decks | ✓ shipped |
| 10 | Deck Inventory (standalone `/decks.html`) | ✓ shipped |
| 11 | **Share Poster** | ⚠️ **NOT YET — last design-spec'd surface remaining** |
| 12 | Pop-ups (sign-in / streak / deck unlock) | ✓ shipped |
| Bonus | `full.html` selection board (B1 pattern, no design spec) | ✓ shipped |
| Bonus | Bottom-nav C2 restructure + cat SVG icons | ✓ shipped |
| Bonus | i18n hard-strip — EN site EN-only / TH site TH-only | ✓ shipped |

---

## 2. What's NEXT (priority order)

### A. Share Poster polish — Section 11 — **HIGHEST PRIORITY**

`share/poster.js` is ~3000 lines of Canvas rendering. The current
`buildPoster()` flow renders daily / question / celtic-cross modes
but the typography doesn't match ScreenPoster in
`/Users/kitikornrakhangthong/projects/MeowTarot new design/MeowTarot_Redesign_final.html`
(line ~1130–1240, `function ScreenPoster()`).

Surgical edits needed:

- Gold dot+line accent line under the "MeowTarot" wordmark at the
  top of the poster
- Date label "Thursday · 28 May" in gold tracked uppercase
- Card art centered (220×340 in design space — translate to 1080-wide
  poster proportions)
- Aura glow `::before` radial gradient behind the card
- Card name in 54px italic-serif `Cormorant Garamond` (translate to
  poster scale)
- Gold ornament accent line + dot below the card
- Tagline in italic-serif 15px, single-language per locale (per the
  recent i18n strip)

**i18n constraint applies:** EN poster = pure English (no Thai
sub-line). TH poster = pure Thai. The existing `share/poster.js`
emits bilingual lines in places — strip per the same rule.

Don't rewrite the file; do surgical edits to `drawPosterBackground`,
the daily-mode block in `buildPoster()`, and the wordmark/date/tagline
draw calls.

### B. TH homepage parity gap — backlog item from CLAUDE.md

`th/index.html` still serves the old 3-card chooser layout — Phase 4
or earlier. The EN `index.html` is Phase 5 (ceremonial hero +
italic-serif wordmark + 3 path cards + horizontal deck strip + app
banner). Mirror the Phase 5 markup over to TH, replace all EN-only
copy with the existing `translations.th` strings.

### C. `/today/` page decision

`/today/` is a separate Phase-4-era page (today.html under `today/`
subdirectory). Bottom-nav now routes "Today" → `/index.html`, so
`/today/` is reachable only via direct URL / GA links / cached
bookmarks. Two paths:

1. Redirect `/today/` → `/index.html` server-side (or via meta
   refresh) — closes the surface cleanly
2. Redesign `/today/` to Phase 5 — keeps it as a distinct surface

Recommend #1 unless there's user data showing `/today/` direct traffic
matters.

### D. Position-label vocabulary audit on Celtic Cross result

`js/reading.js` `getFullPositionLabel(dict, position)` reads from
`translations.en/th` dict keys. The Phase 4 vocabulary may not match
the design doc's "The Situation / Crossing / Crown / Foundation /
Receding Past / Near Future / Self / Environment / Hopes & Fears /
Outcome". Verify by reading the dict and comparing.

### E. `/tarot-card-meanings/` index + 78 card meaning pages

Phase 4 styling, high SEO surface. Not in the design doc. Big scope.
Would need its own design pass before implementation — surface this
to the user before touching.

---

## 3. Hard rules (excerpts from CLAUDE.md — non-negotiable)

1. **Free reading result must always feel complete.** Paid layers
   = "go deeper", never "answer locked".
2. **EN/TH parity** for new features (now meaning: each locale is
   single-language but feature-complete).
3. **All i18n routes through `js/common.js`.** Never inline strings
   in feature files.
4. **Never touch `js/asset-resolver.js`** or the
   `resolvePosterCardImageSources` call order — load-bearing for
   poster generation.
5. **Backward compatibility for legacy share links** — old payloads
   must still resolve.
6. **Patches surgically scoped by mode** — Daily edits don't bleed
   into Question or Full.
7. **Love vertical copy protects user wellbeing.** Forbidden Thai
   phrasings: "เขายังรักคุณแน่นอน", "เขาจะกลับมา", "ต้องรอเขา". Every
   love offer includes self-agency.
8. **LINE share payloads must include reading-specific og:image** —
   never generic site logo. This is the TH virality mechanic. (Hard
   rule 8 directly motivates priority A above.)
9. **Payment plumbing never blocks product launch.**
10. **Edit canonical, not mirrors.** Always edit root `js/` and HTML
    first. `www/` and `ios/` are outputs of `cp + cap sync`. Direct
    mirror edits cause drift.

---

## 4. Mirror-sync workflow

```bash
# After editing canonical files (root js/, root HTML, root css/):
cp js/foo.js www/js/foo.js
cp css/foo.css www/css/foo.css
cp foo.html www/foo.html
cp th/foo.html www/th/foo.html

npx wrangler 2>/dev/null  # (if using wrangler at all — not relevant here)
npx cap sync ios          # syncs www/ → ios/

# Verify md5 across canonical / www / ios:
for f in js/foo.js css/foo.css foo.html th/foo.html; do
  a=$(md5 -q "$f"); b=$(md5 -q "www/$f"); c=$(md5 -q "ios/App/App/public/$f")
  [ "$a" = "$b" ] && [ "$b" = "$c" ] && echo "OK $f" || echo "DIFFER $f"
done

# Commit ONLY canonical files:
git add js/foo.js css/foo.css foo.html th/foo.html
git commit -m "..."

# Push with rebase (mirror diffs are tracked-modified, must stash before pull):
git fetch origin main
git stash push -m mirrors
git pull --rebase origin main
git stash pop
git push origin main
```

---

## 5. LOG_DRAFT workflow

Per CLAUDE.md "Session logging (mandatory)" section: after each
shipped patch, append a JSON-line entry to `LOG_DRAFT.jsonl` at repo
root, then commit + push. The GitHub Action processes it on push,
appends to `docs/log.jsonl`, and clears the draft.

Entry shape (single-line valid JSON):

```json
{"schema_version":1,"id":"YYYY-MM-DD-shortslug","date":"YYYY-MM-DD","author":"dunkin-novice","branch":"main","type":"feat|fix|chore","status":"shipped","trigger":"push","goal":"...","done":"...","files":["..."],"verified":["..."],"guardrails_preserved":["asset-resolver-untouched","en-th-parity","i18n-via-common-only","free-core-complete","legacy-share-links-compat","no-direct-gtag"],"notes":"...","filed":["..."],"affects":["..."]}
```

Recent log entries for style reference: read tail of
`docs/log.jsonl` or the last few `docs(log): ...` commits.

---

## 6. Key file map

```
~/projects/MeowTarot/                        # repo root
├── index.html                               # EN homepage
├── daily.html / full.html / question.html   # EN board pages
├── question-draw.html                       # EN ask card-board
├── decks.html                               # EN deck inventory (NEW Phase 5)
├── profile.html                             # EN profile
├── reading.html                             # EN result page
├── meanings.html                            # EN card meanings index (Phase 4)
├── th/                                      # TH mirrors of each above
├── js/
│   ├── main.js                              # daily / full / question entry rendering
│   ├── reading.js                           # result page (renderDaily/Question/Full)
│   ├── common.js                            # initShell, translations dict, i18n
│   ├── data.js                              # decks, cards, normalizeId — DO NOT touch
│   ├── asset-resolver.js                    # load-bearing — DO NOT touch
│   ├── bottom-nav.js                        # 4-tab floating pill + SVG icons (Phase 5)
│   ├── decks.js                             # /decks.html page (NEW Phase 5)
│   ├── profile.js                           # /profile.html page
│   ├── sign-in-gate.js                      # Phase 5 sign-in popup
│   ├── streak-milestone.js                  # Phase 5 halfway popup
│   ├── deck-reward.js                       # deck-unlock popup (pre-Phase-5)
│   ├── full-reading-position-order.js       # Celtic Cross position keys
│   └── components/, pages/                  # tarot card meanings (Phase 4)
├── css/
│   ├── styles.css                           # Phase 4 globals
│   ├── theme-tokens.css                     # --mt-* tokens
│   ├── phase-2-1-logo.css / phase-2-header.css / phase-3-redesign.css
│   ├── daily.css / full.css / question.css  # page-specific
│   ├── profile.css / decks.css              # NEW Phase 5
│   ├── profile-theme.css                    # Phase 4 — still loaded, overridden
│   └── reading.css                          # result page
├── share/
│   ├── poster.js                            # CANVAS POSTER ~3000 LINES (Section 11)
│   ├── normalize-payload.js                 # legacy share-link compat — DO NOT touch
│   ├── share.js                             # share-page entry
│   └── share.css
├── www/                                     # MIRROR (output of cp from canonical)
├── ios/App/App/public/                      # MIRROR (output of npx cap sync ios)
├── docs/log.jsonl                           # AI session log (auto-appended)
├── LOG_DRAFT.jsonl                          # WRITE log entries here before push
├── CLAUDE.md                                # working agreement — READ FIRST
└── REDESIGN_HANDOFF.md                      # this file
```

---

## 7. Design doc location

```
/Users/kitikornrakhangthong/projects/MeowTarot new design/
├── MeowTarot_Redesign_final.html            # primary design doc
└── MeowTarot Redesign-print.html            # print-friendly variant
```

12 sections, ~3000 lines. Section function names (line numbers in
the primary doc):

- `ScreenHome()` ~440
- `ScreenAsk()` ~730
- `ScreenAskEntry()` ~1516
- `ScreenAskBoardQuick()` / `ScreenAskBoardStory()` ~1660 / 1740
- `ScreenCardBoardDaily()` ~860
- `ScreenDailyBefore()` (removed per user)
- `ScreenDailyAfter()` ~1280
- `ScreenQuickPullResult()` ~1845 (rough)
- `ScreenSpread()` ~1900 (rough)
- `ScreenCelticCross()` ~1826
- `ScreenProfile()` ~953
- `ScreenDeckInventory()` ~2002
- **`ScreenPoster()` ~1130** ← the NEXT one to implement
- `PopupCanvas()` ~2165
- `PopupSignIn()` ~2215
- `PopupStreakMilestone()` ~2304
- `PopupDeckUnlocked()` ~2419
- `BottomNav()` ~336

---

## 8. User preferences (from auto-memory)

Stored at `~/.claude/projects/-Users-kitikornrakhangthong/memory/`:

- **Tap to confirm on selection screens** — user wants explicit
  Continue tap, not auto-advance when selection-max hits
- **Halt on spec gaps** — when a spec step has a logical gap, halt
  and surface before touching code (user explicitly prefers this
  over implement-then-flag)
- **Friend-to-friend reply voice** — avoid section-header stacking,
  em-dash side-info, Rule-of-Three, hedging, "Verdict/Recommendation"
  closers
- **Tracker file location** — `meowtarot-tracker-vNN.md` lives in
  Claude.ai project uploads, not on local disk
- **R2 uploads** — use `npx wrangler` (not on PATH) and
  `r2 object put --remote` (defaults to LOCAL sim); verify via
  remote get + md5, not `--pipe`
- **Never edit mirrors** — edit canonical only; before any "sync www
  → canonical" run `diff -u js/<f> www/js/<f>` first

---

## 9. Composio access (image generation — known blocked)

Composio's Gemini Nano Banana shared pool was depleted as of
2026-06-03. The CLI (`composio execute GEMINI_GENERATE_IMAGE`) and
the MCP path both hit HTTP 429 RESOURCE_EXHAUSTED with the same
"prepayment credits are depleted" error. The user's personal account
has NOT been billed — Composio runs Gemini against its own pool and
that pool is empty. Workarounds:

- Wait for Composio to refill (unknown timeline)
- Use personal Gemini API key directly via curl (bypass Composio)
- Hand-craft SVG instead of raster (the bottom-nav cat icons in this
  branch were done this way)

The Boko + MeowTarot_decks pipelines at
`/Users/kitikornrakhangthong/projects/Boko/` and
`/Users/kitikornrakhangthong/projects/MeowTarot_decks/` use the same
Composio CLI path and currently 429 too.

---

═══════════════════════════════════════════════════════════════════
PROMPT FOR NEW CLAUDE SESSION (copy from here)
═══════════════════════════════════════════════════════════════════

I'm continuing the MeowTarot redesign from a prior session. The repo
is at `/Users/kitikornrakhangthong/projects/MeowTarot`. Phase 5
structural surfaces are ~95% complete; the only remaining design-
spec'd surface is **Section 11 — Share Poster polish**.

Before you start coding:

1. Read `REDESIGN_HANDOFF.md` at repo root in full. It lists what's
   done, what's next, file map, mirror-sync workflow, log-draft
   workflow, hard rules, and user preferences.
2. Read `CLAUDE.md` at repo root — the working agreement. Hard rules
   #4 (asset-resolver.js untouched) and #8 (LINE share = visual
   proof) are both relevant to Section 11.
3. Skim `share/poster.js` (~3000 lines) to understand the existing
   Canvas pipeline. Key functions: `buildPoster()` is the entry
   point, `drawPosterBackground()` paints the bg, `buildCardEntries()`
   loads card data, `renderCelticCrossPoster()` is the celtic path,
   `getDailyStrings()` + `resolveDailyReading()` feed the daily mode.
4. Read the design spec for `ScreenPoster()` at line ~1130 of
   `/Users/kitikornrakhangthong/projects/MeowTarot new design/MeowTarot_Redesign_final.html`.

**Your task — Section 11 Share Poster polish:**

Surgical edits to `share/poster.js` daily-mode poster path so the
rendered Canvas output matches ScreenPoster typography:

- Gold dot+line accent under the "MeowTarot" wordmark at top
- Date label "Thursday · 28 May" in gold tracked uppercase (use the
  reading's date, not literal "28 May")
- Aura glow `::before` radial gradient behind the card art
- Card name in 54px-equivalent italic-serif Cormorant Garamond
  (scale to the 1080-wide PRESETS.story poster)
- Gold ornament accent line + dot below the card
- Tagline in italic-serif 15px-equivalent, **single-language per
  locale**

**Critical i18n constraint:** the most recent shipped commits
(`e43a4d5`, `154a8fc`, `f8a7c35`) stripped all bilingual EN·TH pairs
from the EN site (and made TH site TH-only for symmetry). The
poster must follow the same rule — EN poster renders no Thai, TH
poster renders no English. Audit `getDailyStrings()` and
`resolveDailyReading()` + the wordmark/tagline draw calls for any
bilingual emit patterns and gate them on the lang parameter.

**Workflow:** edit canonical files (root js/, css/), then cp to
`www/`, then `npx cap sync ios`, then verify md5 canonical == www ==
ios. Commit ONLY canonical, stash mirrors before `git pull --rebase
origin main`, then push. Write a LOG_DRAFT.jsonl entry per the
schema in REDESIGN_HANDOFF.md §5 and commit it as a separate
`docs(log): ...` commit before pushing.

**Hard rules** — review CLAUDE.md, but the load-bearing ones for
this task: do not touch `js/asset-resolver.js`, do not touch
`share/normalize-payload.js`, preserve legacy share-link
compatibility, and keep `resolvePosterCardImageSources()` call order
intact. The poster image is the TH virality mechanic per hard rule
#8 — visual proof, not generic logo.

**When done with Section 11**, surface options for the next chunk
of work from REDESIGN_HANDOFF.md §2 (TH homepage parity / `/today/`
decision / position-label audit / tarot-meanings) and let the user
pick. Do NOT proceed past Section 11 without user direction — the
remaining surfaces are not formally in the design doc and need a
human call.

**Halt-and-flag pattern:** if you hit a spec gap (an underspecified
visual detail, an ambiguous color value, a missing string),
**halt and surface it to the user** before guessing. The user has
explicitly stated this preference — halt before code, not after.

Start by reading the three files in step 1–3, then describe your
plan back to the user before editing anything.

═══════════════════════════════════════════════════════════════════
