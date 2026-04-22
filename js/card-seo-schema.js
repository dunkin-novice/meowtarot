function text(value) {
  return String(value || '').trim();
}

function pickLocalized(card, fieldBase, lang = 'en') {
  const en = text(card?.[`${fieldBase}_en`]);
  const th = text(card?.[`${fieldBase}_th`]);
  return lang === 'th' ? (th || en) : (en || th);
}


function getCustomFaq(card, { lang = 'en', displayName = '' } = {}) {
  const id = text(card?.card_id);

  if (id.startsWith('01-the-fool')) {
    return {
      question: lang === 'th' ? 'ไพ่ The Fool หมายถึงอะไรในเรื่องความรัก?' : `What does ${displayName} mean in love?`,
      answer: lang === 'th'
        ? 'ในการอ่านความรัก ไพ่ The Fool สื่อถึงการเริ่มต้นใหม่ ความจริงใจแบบเปิดใจ และการกล้าเสี่ยงด้วยหัวใจ สำหรับคนโสดอาจหมายถึงการพบคนใหม่ที่น่าตื่นเต้น ส่วนคนมีคู่คือการเริ่มบทใหม่ด้วยความเชื่อใจกันมากขึ้น'
        : `In love readings, ${displayName} points to fresh starts, honest curiosity, and taking a heartfelt risk. For singles, it can signal exciting new connections; for couples, it invites trying a new chapter with openness and trust.`,
    };
  }

  if (id.startsWith('13-death')) {
    return {
      question: lang === 'th' ? 'ไพ่ Death เป็นไพ่ไม่ดีไหม?' : `Is ${displayName} card bad?`,
      answer: lang === 'th'
        ? 'โดยมากไม่ใช่ค่ะ ในทาโรต์ ไพ่ Death แทบไม่สื่อถึงความตายตามตัวอักษร แต่สื่อถึงการจบสิ่งเดิม การปล่อยวาง และการเปลี่ยนผ่านเพื่อเริ่มต้นสิ่งใหม่ที่ดีกว่า'
        : `Usually no. In tarot, ${displayName} rarely predicts literal death; it marks necessary endings, release, and transformation so something healthier can begin.`,
    };
  }

  return null;
}

function splitKeywords(raw = '') {
  return text(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function buildCardSchema(card, {
  lang = 'en',
  pageUrl,
  baseUrl = 'https://www.meowtarot.com',
  displayName,
} = {}) {
  const isThai = lang === 'th';
  const description = isThai
    ? (text(card?.meta_description_th) || text(card?.meta_description_en))
    : (text(card?.meta_description_en) || text(card?.meta_description_th));

  const tarotImply = pickLocalized(card, 'tarot_imply', lang);
  const readingSummary = pickLocalized(card, 'reading_summary_preview', lang);
  const archetype = pickLocalized(card, 'archetype', lang);
  const lightKeywords = splitKeywords(card?.keywords_light);
  const shadowKeywords = splitKeywords(card?.keywords_shadow);

  const faq = [];
  if (tarotImply) {
    faq.push({
      '@type': 'Question',
      name: isThai ? `ความหมายหลักของไพ่ ${displayName} คืออะไร?` : `What is the core meaning of ${displayName}?`,
      acceptedAnswer: { '@type': 'Answer', text: tarotImply },
    });
  }
  if (readingSummary) {
    faq.push({
      '@type': 'Question',
      name: isThai ? `${displayName} สื่อถึงอะไรในการเปิดไพ่?` : `What does ${displayName} suggest in a reading?`,
      acceptedAnswer: { '@type': 'Answer', text: readingSummary },
    });
  }

  if (lightKeywords.length || shadowKeywords.length) {
    const answer = isThai
      ? `คำด้านสว่าง: ${lightKeywords.join(', ') || '-'} | คำด้านเงา: ${shadowKeywords.join(', ') || '-'}`
      : `Light keywords: ${lightKeywords.join(', ') || '-'} | Shadow keywords: ${shadowKeywords.join(', ') || '-'}`;
    faq.push({
      '@type': 'Question',
      name: isThai ? `${displayName} มีคีย์เวิร์ดสำคัญอะไรบ้าง?` : `What key themes are associated with ${displayName}?`,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    });
  }

  const customFaq = getCustomFaq(card, { lang, displayName });
  if (customFaq?.question && customFaq?.answer) {
    faq.push({
      '@type': 'Question',
      name: customFaq.question,
      acceptedAnswer: { '@type': 'Answer', text: customFaq.answer },
    });
  }

  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: isThai ? `${displayName} ความหมายไพ่ทาโรต์` : `${displayName} Tarot Meaning`,
      description,
      inLanguage: isThai ? 'th-TH' : 'en-US',
    },
    {
      '@type': 'DefinedTerm',
      '@id': `${pageUrl}#definedterm`,
      name: displayName,
      description: tarotImply || description,
      inDefinedTermSet: isThai
        ? `${baseUrl}/th/tarot-card-meanings/`
        : `${baseUrl}/tarot-card-meanings/`,
      inLanguage: isThai ? 'th-TH' : 'en-US',
      alternateName: archetype || undefined,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumbs`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: isThai ? 'หน้าแรก' : 'Home',
          item: isThai ? `${baseUrl}/th/` : `${baseUrl}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: isThai ? 'ความหมายไพ่ทาโรต์' : 'Tarot Card Meanings',
          item: isThai ? `${baseUrl}/th/tarot-card-meanings/` : `${baseUrl}/tarot-card-meanings/`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: displayName,
          item: pageUrl,
        },
      ],
    },
  ];

  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      inLanguage: isThai ? 'th-TH' : 'en-US',
      mainEntity: faq,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
