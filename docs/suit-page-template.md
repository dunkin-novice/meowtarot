# Suit Page Template (Major Arcana, Wands, Cups, Swords, Pentacles)

This template defines a high-SEO, browseable suit landing page that drives traffic into individual card meaning pages while supporting bilingual content (EN/TH) and consistent routing.

## Recommended default
- **Layout option:** **Grid default with list toggle** (Option A). Grid maximizes visual scannability and click-through to card pages; list remains available for dense reading and accessibility.

## Page anatomy (top → bottom)
1. **Global chrome**
   - Header/nav shared with Hub + Card pages.
   - Breadcrumbs: `Home → Card Meanings → <Suit>`.
2. **Hero / Intro**
   - **H1:** "<Suit> Tarot Card Meanings" (localized text via i18n keys).
   - 2–4 line intro describing the suit's element/energy keywords.
   - **Chips row:**
     - Element (e.g., Fire for Wands; blank for Major Arcana).
     - Theme keywords ("passion, action, ambition").
     - Count badge (e.g., 14 for suits, 22 for Major Arcana).
3. **Browse controls (sticky on mobile)**
   - **View toggle:** Grid | List (grid default).
   - **Sort selector:**
     - Canonical order (Ace → King or 0 → 21) default.
     - A–Z optional sort.
   - **Filter chips (non-URL, optional query params):** Upright focus, Reversed focus, Love, Career. Active state shows applied filter and updates count.
4. **Card index (core content)**
   - **Grid view (default):**
     - Card image (lazy-loaded) with consistent aspect.
     - Card name with visible position/order (Ace, Two… / 0–21).
     - Three quick keyword chips (upright/reversed mix allowed).
     - Entire card tile is an HTML link to `/tarot-card-meanings/<card-slug>` (localized equivalent).
   - **List view:**
     - Smaller thumbnail (lazy-loaded) + name + position/order.
     - One-line summary plus "Upright/Reversed" hint.
     - Tap/click target spans the whole row and links to the base meaning page.
5. **Mini guide**
   - **How to read <Suit> in a spread:** 3–5 bullets (energy, timing, shadow cues).
   - **Common pairings:** Inline links to related suits or guides (e.g., Fire + Air synergies).
6. **Internal linking**
   - **Explore other suits:** Links to the other four suits plus Major Arcana.
   - **Popular cards in this suit (optional):** Up to 6 inline links.
7. **FAQ (suit-level SEO)**
   - 4–6 questions such as "What do Wands represent?", "Are Wands always positive?".
   - Add FAQ schema block if available; ensure accordion content is crawlable.

## Components and states
- **HeroSection**: Accepts `title`, `lede`, `chips[]`, `badgeCount`.
- **Breadcrumbs**: Reusable with schema markup.
- **ViewToggle**: Radio/segmented control; persists selection per session/localStorage.
- **SortSelect**: Dropdown for canonical vs. A–Z; canonical is pinned as default.
- **FilterChips**: Multi-select chips; does not change URL unless query params are implemented.
- **CardGrid / CardList**: Shared data source with card name, slug, image, order, upright/reversed keywords.
- **MiniGuide**: Two stacked panels for tips and pairings.
- **ExploreSuits**: Horizontal cards/links to other suits; maintain consistent URL pattern.
- **FAQAccordion**: Accessible accordion with schema-ready JSON-LD injection.

## Responsive behavior
- **Mobile**
  - Browse controls become sticky beneath the hero for fast filtering.
  - Grid becomes 2-column; list remains single-column with large tap targets.
  - Chips and filters wrap; count badge stays visible.
- **Tablet**
  - Grid 3-column; list shows inline upright/reversed hint.
- **Desktop**
  - Grid 4–5 columns depending on width; filters inline with sort toggle.
  - Hero intro spans readable width (~70ch) with chips aligned to baseline.

## SEO and localization
- **Canonical URL:** `/tarot-card-meanings/<suit>`.
- **Meta title/description:** Include suit keyword and element/energy terms.
- **hreflang:** EN/TH pairs for suit URLs.
- **Index content in HTML:** Card links are native `<a>` tags (no JS-only handlers).
- **Structured data:** Breadcrumbs + FAQ schema where available.

## Content requirements (per suit)
- Suit intro lede with 2–4 lines.
- Element chip (skip for Major Arcana), theme keywords chip, count badge.
- 14 or 22 cards with consistent ordering metadata.
- Mini guide bullets and at least 4 FAQs tailored to the suit.

## Interaction details
- **Lazy-load images** via `loading="lazy"` and sized placeholders to reduce CLS.
- **Hover/focus states** for tiles with subtle elevation/outline for accessibility.
- **Keyboard navigation**: View toggle, sort, filters, and card links are tabbable.
- **Analytics hooks**: Track view-toggle changes and card clicks to optimize CTR.
