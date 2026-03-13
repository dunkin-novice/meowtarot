# 1. PAGE STRATEGY

The single-card meaning page should function as an evergreen **SEO landing page**, a **reader interpretation page**, and a **navigation hub** back into Meow Tarot journeys.

Why this template works in Meow Tarot's ecosystem:
- **SEO intent coverage:** each card gets one canonical meaning URL keyed by `seo_slug_en`.
- **Interpretation depth:** the page moves from quick scan → timeline interpretation → topic-specific readings (love/career/finance) → actionable ritual/reflection.
- **Recirculation:** built-in internal link zones route users to the meanings index, hierarchy hubs (suit/arcana), related cards, and reading flows (daily/full).
- **Scalability:** section blocks map directly to JSON keys so all 78 cards can render consistently.
- **Bilingual-ready:** every section is language-slot based (EN first, TH second), allowing EN-only, TH-only, or stacked bilingual output.
- **Orientation-safe:** upright/reversed can be represented with one reusable template via orientation badge + orientation-aware content labels, without requiring separate URLs.

---

# 2. SECTION MAP

## 2.1 Breadcrumb / Page Context
**Uses fields:**
- `card_name_en`
- `alias_th` (optional display in current-card label)
- (structural placeholder) suit/arcana hub key from card taxonomy source

## 2.2 Hero / Intro
**Uses fields:**
- `card_name_en`
- `alias_th`
- `archetype_en`
- `archetype_th`
- `orientation`
- `icon_emoji`
- `tarot_imply_en`
- `tarot_imply_th`
- `hook_en`
- `hook_th`
- `image_alt_en`
- `illustration_prompt_en` (dev note only; not public by default)

## 2.3 Quick Meaning Snapshot
**Uses fields:**
- `keywords_light`
- `keywords_shadow`
- `yes_no_bias`
- `timing_hint`
- `decision_support`
- `planet`
- `element`
- `numerology_value`
- `astrology_sign`
- `color_palette`

## 2.4 Main Interpretation Timeline
**Uses fields:**
- `standalone_past_en`, `standalone_past_th`
- `standalone_present_en`, `standalone_present_th`
- `standalone_future_en`, `standalone_future_th`

## 2.5 Reading Digest / Summary
**Uses fields:**
- `reading_summary_preview_en`, `reading_summary_preview_th`
- `reading_summary_past_en`, `reading_summary_past_th`
- `reading_summary_present_en`, `reading_summary_present_th`
- `reading_summary_future_en`, `reading_summary_future_th`

## 2.6 Love / Relationship
**Uses fields:**
- `love_past_en`, `love_past_th`
- `love_present_en`, `love_present_th`
- `love_future_en`, `love_future_th`
- `love_reading_single_en`, `love_reading_single_th`
- `love_reading_couple_en`, `love_reading_couple_th`

## 2.7 Career
**Uses fields:**
- `career_past_en`, `career_past_th`
- `career_present_en`, `career_present_th`
- `career_future_en`, `career_future_th`

## 2.8 Finance
**Uses fields:**
- `finance_past_en`, `finance_past_th`
- `finance_present_en`, `finance_present_th`
- `finance_future_en`, `finance_future_th`

## 2.9 Action / Reflection / Ritual
**Uses fields:**
- `action_prompt_en`, `action_prompt_th`
- `reflection_question_en`, `reflection_question_th`
- `affirmation_en`, `affirmation_th`
- `ritual_2min_en`, `ritual_2min_th`
- `journal_prompt_3lines_en`, `journal_prompt_3lines_th`
- `breath_pattern`

## 2.10 Symbolism / Metadata
**Uses fields:**
- `planet`
- `element`
- `numerology_value`
- `astrology_sign`
- `color_palette`
- `icon_emoji`
- `image_alt_en`

## 2.11 Internal Linking / Next Steps
**Uses fields:**
- (structural links) meanings index route
- (placeholder data source) related cards list
- (placeholder data source) same suit / same arcana hub route
- (static route) daily reading
- (static route) full reading

## 2.12 SEO / Meta Notes
**Uses fields:**
- `seo_slug_en`
- `meta_description_en`
- `meta_description_th`

---

# 3. HTML / JSX LAYOUT

```html
<main class="page" data-template="tarot-card-meaning" data-orientation="{orientation}">
  <nav class="page-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/tarot-card-meanings/">Tarot Card Meanings</a></li>
      <!-- Optional taxonomy hub breadcrumb; render only if taxonomy data exists -->
      <li>
        <a href="{hubUrl}">{hubLabel}</a>
      </li>
      <li aria-current="page">
        {card_name_en}
        <!-- optional: <span lang="th">({alias_th})</span> -->
      </li>
    </ol>
  </nav>

  <article>
    <header class="card-hero">
      <p class="card-hero__orientation">
        <strong>Orientation:</strong> {orientation}
      </p>

      <h1>
        <span>{card_name_en}</span>
        <!-- render if exists -->
        <small lang="th">{alias_th}</small>
      </h1>

      <p class="card-hero__archetype">
        <span>{icon_emoji}</span>
        <span>{archetype_en}</span>
        <span lang="th">{archetype_th}</span>
      </p>

      <p class="card-hero__imply">
        <span>{tarot_imply_en}</span>
        <span lang="th">{tarot_imply_th}</span>
      </p>

      <p class="card-hero__hook">
        <span>{hook_en}</span>
        <span lang="th">{hook_th}</span>
      </p>

      <!-- Optional dev-only note, not public by default -->
      <!-- <aside data-dev-note>{illustration_prompt_en}</aside> -->

      <!-- card image block if image URL exists from upstream source -->
      <figure>
        <img src="{cardImageUrl}" alt="{image_alt_en}" />
      </figure>
    </header>

    <section class="meaning-snapshot" aria-labelledby="meaning-snapshot-title">
      <h2 id="meaning-snapshot-title">Quick Meaning Snapshot</h2>

      <ul>
        <li><strong>Light keywords:</strong> {keywords_light}</li>
        <li><strong>Shadow keywords:</strong> {keywords_shadow}</li>
        <li><strong>Yes / No bias:</strong> {yes_no_bias}</li>
        <li><strong>Timing hint:</strong> {timing_hint}</li>
        <li><strong>Decision support:</strong> {decision_support}</li>
      </ul>

      <aside>
        <ul>
          <li><strong>Planet:</strong> {planet}</li>
          <li><strong>Element:</strong> {element}</li>
          <li><strong>Numerology:</strong> {numerology_value}</li>
          <li><strong>Astrology sign:</strong> {astrology_sign}</li>
          <li><strong>Color palette:</strong> {color_palette}</li>
        </ul>
      </aside>
    </section>

    <section class="meaning-timeline" aria-labelledby="timeline-title">
      <h2 id="timeline-title">Main Interpretation Timeline</h2>

      <div>
        <section>
          <h3>Past</h3>
          <p>{standalone_past_en}</p>
          <p lang="th">{standalone_past_th}</p>
        </section>

        <section>
          <h3>Present</h3>
          <p>{standalone_present_en}</p>
          <p lang="th">{standalone_present_th}</p>
        </section>

        <section>
          <h3>Future</h3>
          <p>{standalone_future_en}</p>
          <p lang="th">{standalone_future_th}</p>
        </section>
      </div>
    </section>

    <section class="reading-digest" aria-labelledby="reading-digest-title">
      <h2 id="reading-digest-title">Reading Digest</h2>

      <p><strong>Preview:</strong> {reading_summary_preview_en}</p>
      <p lang="th"><strong>พรีวิว:</strong> {reading_summary_preview_th}</p>

      <ul>
        <li>
          <strong>Past:</strong>
          <span>{reading_summary_past_en}</span>
          <span lang="th">{reading_summary_past_th}</span>
        </li>
        <li>
          <strong>Present:</strong>
          <span>{reading_summary_present_en}</span>
          <span lang="th">{reading_summary_present_th}</span>
        </li>
        <li>
          <strong>Future:</strong>
          <span>{reading_summary_future_en}</span>
          <span lang="th">{reading_summary_future_th}</span>
        </li>
      </ul>
    </section>

    <section class="love-section" aria-labelledby="love-title">
      <h2 id="love-title">Love & Relationships</h2>

      <article>
        <h3>Timeline</h3>
        <ul>
          <li><strong>Past:</strong> {love_past_en} <span lang="th">{love_past_th}</span></li>
          <li><strong>Present:</strong> {love_present_en} <span lang="th">{love_present_th}</span></li>
          <li><strong>Future:</strong> {love_future_en} <span lang="th">{love_future_th}</span></li>
        </ul>
      </article>

      <article>
        <h3>Single</h3>
        <p>{love_reading_single_en}</p>
        <p lang="th">{love_reading_single_th}</p>
      </article>

      <article>
        <h3>Couple</h3>
        <p>{love_reading_couple_en}</p>
        <p lang="th">{love_reading_couple_th}</p>
      </article>
    </section>

    <section class="career-section" aria-labelledby="career-title">
      <h2 id="career-title">Career</h2>
      <ul>
        <li><strong>Past:</strong> {career_past_en} <span lang="th">{career_past_th}</span></li>
        <li><strong>Present:</strong> {career_present_en} <span lang="th">{career_present_th}</span></li>
        <li><strong>Future:</strong> {career_future_en} <span lang="th">{career_future_th}</span></li>
      </ul>
    </section>

    <section class="finance-section" aria-labelledby="finance-title">
      <h2 id="finance-title">Finance</h2>
      <ul>
        <li><strong>Past:</strong> {finance_past_en} <span lang="th">{finance_past_th}</span></li>
        <li><strong>Present:</strong> {finance_present_en} <span lang="th">{finance_present_th}</span></li>
        <li><strong>Future:</strong> {finance_future_en} <span lang="th">{finance_future_th}</span></li>
      </ul>
    </section>

    <section class="ritual-section" aria-labelledby="ritual-title">
      <h2 id="ritual-title">Action, Reflection & Ritual</h2>

      <article>
        <h3>Action Prompt</h3>
        <p>{action_prompt_en}</p>
        <p lang="th">{action_prompt_th}</p>
      </article>

      <article>
        <h3>Reflection Question</h3>
        <p>{reflection_question_en}</p>
        <p lang="th">{reflection_question_th}</p>
      </article>

      <article>
        <h3>Affirmation</h3>
        <blockquote>{affirmation_en}</blockquote>
        <blockquote lang="th">{affirmation_th}</blockquote>
      </article>

      <article>
        <h3>2-minute Ritual</h3>
        <p>{ritual_2min_en}</p>
        <p lang="th">{ritual_2min_th}</p>
      </article>

      <article>
        <h3>3-line Journal Prompt</h3>
        <p>{journal_prompt_3lines_en}</p>
        <p lang="th">{journal_prompt_3lines_th}</p>
      </article>

      <article>
        <h3>Breath Pattern</h3>
        <p>{breath_pattern}</p>
      </article>
    </section>

    <section class="symbolism-meta" aria-labelledby="symbolism-title">
      <h2 id="symbolism-title">Symbolism & Metadata</h2>
      <dl>
        <dt>Planet</dt><dd>{planet}</dd>
        <dt>Element</dt><dd>{element}</dd>
        <dt>Numerology</dt><dd>{numerology_value}</dd>
        <dt>Astrology sign</dt><dd>{astrology_sign}</dd>
        <dt>Color palette</dt><dd>{color_palette}</dd>
        <dt>Icon</dt><dd>{icon_emoji}</dd>
        <dt>Image alt</dt><dd>{image_alt_en}</dd>
      </dl>
    </section>

    <footer>
      <section class="related-links" aria-labelledby="related-links-title">
        <h2 id="related-links-title">Explore Next</h2>
        <ul>
          <li><a href="/tarot-card-meanings/">Back to Tarot Card Meanings Index</a></li>
          <!-- Placeholder: inject related cards from relationship dataset -->
          <li><a href="{relatedCardUrl}">{relatedCardLabel}</a></li>
          <!-- Placeholder: suit/arcana hub link when taxonomy is available -->
          <li><a href="{sameGroupHubUrl}">{sameGroupHubLabel}</a></li>
        </ul>
      </section>

      <section class="reading-cta" aria-labelledby="reading-cta-title">
        <h2 id="reading-cta-title">Continue Your Reading</h2>
        <p>Use this card insight in a live spread.</p>
        <p>
          <a href="/daily.html">Start Daily Reading</a>
          <a href="/full.html">Start Full Reading</a>
        </p>
      </section>

      <aside class="seo-notes" hidden>
        <p>seo_slug_en: {seo_slug_en}</p>
        <p>meta_description_en: {meta_description_en}</p>
        <p>meta_description_th: {meta_description_th}</p>
      </aside>
    </footer>
  </article>
</main>
```

---

# 4. REUSABLE COMPONENTS

1. **Breadcrumbs**
   - Inputs: home URL, meanings index URL, optional hub URL/label, card name.

2. **CardHero**
   - Inputs: identity (`card_name_en`, `alias_th`), archetypes, orientation, hooks, implication, image alt.

3. **MeaningSnapshot**
   - Inputs: keywords, yes/no bias, timing hint, decision support, symbolic chips.

4. **TimelineMeaning**
   - Inputs: standalone past/present/future (EN/TH).

5. **ReadingDigest**
   - Inputs: preview + timeline digest (EN/TH).

6. **LoveMeaning**
   - Inputs: timeline + single/couple (EN/TH).

7. **CareerMeaning**
   - Inputs: career timeline (EN/TH).

8. **FinanceMeaning**
   - Inputs: finance timeline (EN/TH).

9. **PracticalGuidance**
   - Inputs: action prompt, reflection question, affirmation, ritual, journal prompt, breath pattern.

10. **SymbolismMeta**
    - Inputs: planet/element/numerology/astrology/colors/icon/image alt.

11. **RelatedLinks**
    - Inputs: index URL, optional related cards dataset, optional same-group hub.

12. **ReadingCTA**
    - Inputs: daily/full URLs + optional tracking labels.

---

# 5. IMPLEMENTATION NOTES

- **Empty-field handling**
  - Any field that is null/empty string should not render its UI row/block.
  - For grouped sections (e.g., Love timeline), render only available rows.
  - If all fields in a section are empty, omit entire section.

- **Bilingual rendering strategy**
  - Support three render modes: `en`, `th`, `both`.
  - In `both`, stack EN first then TH for each micro-block to preserve context alignment.
  - Add `lang="th"` for Thai nodes for accessibility and proper text shaping.

- **Upright/reversed badge logic**
  - One page template, orientation surfaced in hero and quick snapshot.
  - Orientation label should be persistent (badge/chip) and machine-readable (`data-orientation`).
  - Tone differences should come from JSON fields for the selected orientation, not hardcoded copy.

- **SEO/meta placement**
  - Canonical slug source: `seo_slug_en`.
  - EN route: `/tarot-card-meanings/{seo_slug_en}/`.
  - TH route: `/th/tarot-card-meanings/{seo_slug_en}/`.
  - `meta_description_en` and `meta_description_th` populate language-specific meta descriptions.

- **Canonical assumptions**
  - One-card-one-canonical-page per language.
  - Upright/reversed states are content states within the same canonical page unless architecture changes later.

- **Internal linking placeholders**
  - Keep explicit placeholders for related cards and same-group hub URLs; these require taxonomy/relationship data external to this single-card JSON.
  - Always include links back to meanings index and reading flow CTAs.

- **Route parity assumptions (EN/TH)**
  - Every EN card route should have TH counterpart using same `seo_slug_en`.
  - Section structure remains identical across locales for maintainability.

---

# 6. OPTIONAL IMPROVEMENTS

1. Add sticky in-page table of contents for long sections.
2. Add orientation toggle tabs (upright/reversed) if both datasets are loaded client-side.
3. Add collapsible mobile accordions for Love/Career/Finance to reduce scroll fatigue.
4. Add visual keyword chips + icon badges from snapshot metadata.
5. Add structured data blocks (e.g., `FAQPage` / `WebPage`) generated from existing JSON fields only.
6. Add gentle progress markers (Hero → Snapshot → Timeline → Practical → Next Steps) for better completion flow.
