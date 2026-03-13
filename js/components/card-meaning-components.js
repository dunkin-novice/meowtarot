function isBlank(value) {
  return value === null || value === undefined || `${value}`.trim() === '';
}

function row(label, value, { lang = '', strong = false } = {}) {
  if (isBlank(value)) return '';
  const content = strong ? `<strong>${value}</strong>` : `${value}`;
  return `<p${lang ? ` lang="${lang}"` : ''}><span>${label}:</span> ${content}</p>`;
}

function stacked(enValue, thValue, { enLabel = '', thLabel = '', useParagraph = true } = {}) {
  const en = isBlank(enValue) ? '' : (useParagraph ? `<p>${enLabel ? `<strong>${enLabel}</strong> ` : ''}${enValue}</p>` : `${enValue}`);
  const th = isBlank(thValue) ? '' : (useParagraph ? `<p lang="th">${thLabel ? `<strong>${thLabel}</strong> ` : ''}${thValue}</p>` : `${thValue}`);
  return `${en}${th}`;
}

function splitCsv(value = '') {
  if (isBlank(value)) return [];
  return `${value}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listGroup(title, entries = []) {
  const rows = entries
    .filter((entry) => !isBlank(entry?.value))
    .map((entry) => `<li>${entry.label ? `<strong>${entry.label}:</strong> ` : ''}${entry.value}</li>`)
    .join('');

  if (!rows) return '';
  return `
    <article>
      <h3>${title}</h3>
      <ul>${rows}</ul>
    </article>
  `;
}

export function renderCardHero(card, orientationLabel, imageUrl, mode = 'en') {
  const showEn = mode !== 'th';
  const showTh = mode !== 'en';
  const title = showEn ? card.card_name_en : (card.alias_th || card.card_name_en);

  return `
    <p class="card-hero__orientation"><strong>Orientation:</strong> ${orientationLabel}</p>
    <h1>${title}${showTh && !isBlank(card.alias_th) && showEn ? `<small lang="th">${card.alias_th}</small>` : ''}</h1>
    ${showEn && !isBlank(card.archetype_en) ? `<p>${card.icon_emoji || ''} ${card.archetype_en}</p>` : ''}
    ${showTh && !isBlank(card.archetype_th) ? `<p lang="th">${card.icon_emoji || ''} ${card.archetype_th}</p>` : ''}
    ${showEn && !isBlank(card.tarot_imply_en) ? `<p>${card.tarot_imply_en}</p>` : ''}
    ${showTh && !isBlank(card.tarot_imply_th) ? `<p lang="th">${card.tarot_imply_th}</p>` : ''}
    ${showEn && !isBlank(card.hook_en) ? `<p>${card.hook_en}</p>` : ''}
    ${showTh && !isBlank(card.hook_th) ? `<p lang="th">${card.hook_th}</p>` : ''}
    ${!isBlank(imageUrl) ? `<figure><img id="cardImage" src="${imageUrl}" alt="${card.image_alt_en || card.card_name_en || 'Tarot card'}" loading="lazy" /></figure>` : ''}
  `;
}

export function renderMeaningSnapshot(card, mode = 'en') {
  const showEn = mode !== 'th';
  const showTh = mode !== 'en';

  const chips = [
    { label: 'Yes/No bias', value: card.yes_no_bias },
    { label: 'Timing hint', value: card.timing_hint },
    { label: 'Decision support', value: card.decision_support },
    { label: 'Planet', value: card.planet },
    { label: 'Element', value: card.element },
    { label: 'Numerology', value: card.numerology_value },
    { label: 'Astrology sign', value: card.astrology_sign || card.zodiac_sign },
    { label: 'Color palette', value: card.color_palette },
  ].filter((item) => !isBlank(item.value));

  const lightKeywords = splitCsv(card.keywords_light);
  const shadowKeywords = splitCsv(card.keywords_shadow);

  if (!chips.length && !lightKeywords.length && !shadowKeywords.length) return '';

  return `
    <h2>Quick Meaning Snapshot</h2>
    ${showEn && lightKeywords.length ? `<p><strong>Light keywords:</strong> ${lightKeywords.join(', ')}</p>` : ''}
    ${showEn && shadowKeywords.length ? `<p><strong>Shadow keywords:</strong> ${shadowKeywords.join(', ')}</p>` : ''}
    ${showTh && !isBlank(card.keywords_light) ? `<p lang="th"><strong>คีย์เวิร์ดด้านสว่าง:</strong> ${card.keywords_light}</p>` : ''}
    ${showTh && !isBlank(card.keywords_shadow) ? `<p lang="th"><strong>คีย์เวิร์ดด้านเงา:</strong> ${card.keywords_shadow}</p>` : ''}
    <ul>${chips.map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`).join('')}</ul>
  `;
}

export function renderTimeline(card, mode = 'en') {
  const blocks = [
    { title: 'Past', en: card.standalone_past_en, th: card.standalone_past_th },
    { title: 'Present', en: card.standalone_present_en, th: card.standalone_present_th },
    { title: 'Future', en: card.standalone_future_en, th: card.standalone_future_th },
  ];

  const hasContent = blocks.some((b) => !isBlank(b.en) || !isBlank(b.th));
  if (!hasContent) return '';

  return `
    <h2>Main Interpretation Timeline</h2>
    ${blocks.map((block) => `
      <article>
        <h3>${block.title}</h3>
        ${mode !== 'th' && !isBlank(block.en) ? `<p>${block.en}</p>` : ''}
        ${mode !== 'en' && !isBlank(block.th) ? `<p lang="th">${block.th}</p>` : ''}
      </article>
    `).join('')}
  `;
}

export function renderReadingDigest(card, mode = 'en') {
  const preview = stacked(card.reading_summary_preview_en, card.reading_summary_preview_th, { enLabel: 'Preview', thLabel: 'สรุป' });
  const items = [
    { label: 'Past', en: card.reading_summary_past_en, th: card.reading_summary_past_th },
    { label: 'Present', en: card.reading_summary_present_en, th: card.reading_summary_present_th },
    { label: 'Future', en: card.reading_summary_future_en, th: card.reading_summary_future_th },
  ];
  if (isBlank(preview) && items.every((i) => isBlank(i.en) && isBlank(i.th))) return '';
  return `
    <h2>Reading Digest</h2>
    ${preview}
    ${items.map((item) => `
      <article>
        <h3>${item.label}</h3>
        ${mode !== 'th' && !isBlank(item.en) ? `<p>${item.en}</p>` : ''}
        ${mode !== 'en' && !isBlank(item.th) ? `<p lang="th">${item.th}</p>` : ''}
      </article>
    `).join('')}
  `;
}

export function renderTopicTimeline(title, timeline, mode = 'en') {
  const groups = [
    { label: 'Past', en: timeline.pastEn, th: timeline.pastTh },
    { label: 'Present', en: timeline.presentEn, th: timeline.presentTh },
    { label: 'Future', en: timeline.futureEn, th: timeline.futureTh },
  ];
  if (groups.every((item) => isBlank(item.en) && isBlank(item.th))) return '';
  return `
    <h2>${title}</h2>
    <ul>
      ${groups.map((item) => `
        <li>
          <strong>${item.label}:</strong>
          ${mode !== 'th' && !isBlank(item.en) ? `<span>${item.en}</span>` : ''}
          ${mode !== 'en' && !isBlank(item.th) ? `<span lang="th">${item.th}</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

export function renderLove(card, mode = 'en') {
  const timeline = renderTopicTimeline('Love & Relationships', {
    pastEn: card.love_past_en,
    pastTh: card.love_past_th,
    presentEn: card.love_present_en,
    presentTh: card.love_present_th,
    futureEn: card.love_future_en,
    futureTh: card.love_future_th,
  }, mode);

  const single = mode !== 'th' ? card.love_reading_single_en : card.love_reading_single_th;
  const couple = mode !== 'th' ? card.love_reading_couple_en : card.love_reading_couple_th;
  const singleStack = stacked(card.love_reading_single_en, card.love_reading_single_th);
  const coupleStack = stacked(card.love_reading_couple_en, card.love_reading_couple_th);
  const singleBlock = mode === 'both' ? singleStack : (!isBlank(single) ? `<p>${single}</p>` : '');
  const coupleBlock = mode === 'both' ? coupleStack : (!isBlank(couple) ? `<p>${couple}</p>` : '');

  if (!timeline && !singleBlock && !coupleBlock) return '';
  return `${timeline}
    ${singleBlock ? `<article><h3>Single</h3>${singleBlock}</article>` : ''}
    ${coupleBlock ? `<article><h3>Couple</h3>${coupleBlock}</article>` : ''}
  `;
}

export function renderPracticalGuidance(card, mode = 'en') {
  const blocks = [
    { title: 'Action Prompt', en: card.action_prompt_en, th: card.action_prompt_th },
    { title: 'Reflection Question', en: card.reflection_question_en, th: card.reflection_question_th },
    { title: 'Affirmation', en: card.affirmation_en, th: card.affirmation_th },
    { title: '2-minute Ritual', en: card.ritual_2min_en, th: card.ritual_2min_th },
    { title: '3-line Journal Prompt', en: card.journal_prompt_3lines_en, th: card.journal_prompt_3lines_th },
    { title: 'Breath Pattern', en: card.breath_pattern, th: '' },
  ];

  if (blocks.every((block) => isBlank(block.en) && isBlank(block.th))) return '';

  return `
    <h2>Action, Reflection & Ritual</h2>
    ${blocks.map((block) => {
      if (isBlank(block.en) && isBlank(block.th)) return '';
      return `
        <article>
          <h3>${block.title}</h3>
          ${mode !== 'th' && !isBlank(block.en) ? `<p>${block.en}</p>` : ''}
          ${mode !== 'en' && !isBlank(block.th) ? `<p lang="th">${block.th}</p>` : ''}
        </article>
      `;
    }).join('')}
  `;
}

export function renderSymbolism(card) {
  const metadata = [
    ['Planet', card.planet],
    ['Element', card.element],
    ['Numerology', card.numerology_value],
    ['Astrology sign', card.astrology_sign || card.zodiac_sign],
    ['Color palette', card.color_palette],
    ['Icon', card.icon_emoji],
    ['Image alt', card.image_alt_en],
  ].filter(([, value]) => !isBlank(value));

  if (!metadata.length) return '';
  return `
    <h2>Symbolism & Metadata</h2>
    <dl>
      ${metadata.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}
    </dl>
  `;
}

export function renderRelatedLinks({
  indexPath,
  hubPath = '#',
  hubLabel = 'Same suit / arcana group',
  relatedCards = [],
  mode = 'en',
}) {
  const isThai = mode === 'th';
  const showBoth = mode === 'both';

  const relatedItems = relatedCards.length
    ? relatedCards.map((card) => {
      const label = isThai
        ? (card.alias_th || card.card_name_en)
        : showBoth
          ? `${card.card_name_en}${card.alias_th ? ` (${card.alias_th})` : ''}`
          : card.card_name_en;
      const href = isThai ? `/th/tarot-card-meanings/${card.slug}/` : `/tarot-card-meanings/${card.slug}/`;
      return `<li><a href="${href}">${label}</a></li>`;
    }).join('')
    : `<li><span>${isThai ? 'ยังไม่มีรายการไพ่ที่เกี่ยวข้อง' : 'No related cards available yet.'}</span></li>`;

  const dailyHref = isThai ? '/th/daily.html' : '/daily.html';
  const fullHref = isThai ? '/th/full.html' : '/full.html';

  return `
    <h2>${isThai ? 'อ่านต่อ' : 'Explore Next'}</h2>
    <ul>
      <li><a href="${indexPath}">${isThai ? 'กลับไปหน้าคลังความหมายไพ่' : 'Back to Tarot Card Meanings index'}</a></li>
      <li><a href="${hubPath}">${hubLabel}</a></li>
      ${relatedItems}
      <li><a href="${dailyHref}">${isThai ? 'เริ่ม Daily Reading' : 'Start Daily Reading'}</a></li>
      <li><a href="${fullHref}">${isThai ? 'เริ่ม Full Reading' : 'Start Full Reading'}</a></li>
    </ul>
  `;
}

export function renderReadingCta(isThai) {
  const daily = isThai ? '/th/daily.html' : '/daily.html';
  const full = isThai ? '/th/full.html' : '/full.html';
  return `
    <h2>${isThai ? 'ไปต่อในการอ่านไพ่' : 'Continue Your Reading'}</h2>
    <p>${isThai ? 'ใช้ความหมายของไพ่ใบนี้ในสเปรดถัดไป' : 'Use this card insight in a live spread.'}</p>
    <p>
      <a href="${daily}">${isThai ? 'เริ่ม Daily Reading' : 'Start Daily Reading'}</a>
      <a href="${full}">${isThai ? 'เริ่ม Full Reading' : 'Start Full Reading'}</a>
    </p>
  `;
}

export function hasContent(value) {
  return !isBlank(value);
}
