import { initShell } from './common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from './data.js';
import { getCanonicalCardPath } from './canonical-card-routes.js';

const SUIT_RANGES = {
  major: { start: 1, end: 22 },
  wands: { start: 23, end: 36 },
  cups: { start: 37, end: 50 },
  swords: { start: 51, end: 64 },
  pentacles: { start: 65, end: 78 },
};

const SUIT_COPY = {
  major: {
    name: 'Major Arcana',
    slug: 'major',
    path: '/tarot-card-meanings/major',
    title: 'Major Arcana Tarot Card Meanings',
    intro:
      'The Major Arcana follows the Fool’s journey through every life milestone. Each archetype reveals a turning point—awakening, challenge, or integration—that ripples across every area of your life.',
    element: 'All elements',
    themes: ['Archetypes', 'Soul lessons', 'Destiny shifts'],
    highlights: ['Numbers 0–21 · The Fool to The World', 'Use when you want the big picture of a reading'],
    guide: {
      lead: 'Ask big, zoomed-out questions. These archetypes signal defining plot points and invite you to link past, present, and future.',
      steps: [
        {
          title: 'Spot the chapter',
          text: 'Notice whether a card signals a beginning (The Fool, The Magician), midpoint test (Strength, Death), or finale (Judgement, The World).',
        },
        {
          title: 'Map the lesson',
          text: 'Pair the card with your question: what belief, choice, or surrender is being asked of you right now?',
        },
        {
          title: 'Anchor the advice',
          text: 'Summarize the card’s light and shadow in one line you can act on today.',
        },
      ],
    },
    faqLead: 'Understand how to read the 22 archetypes without splitting upright vs reversed URLs.',
    faqs: [
      {
        q: 'What makes the Major Arcana different from the suits?',
        a: 'They chart the core life journey—identity, values, spiritual growth—versus situational themes like career or relationships covered by the Minor suits.',
      },
      {
        q: 'Should I always include a Major Arcana card in a spread?',
        a: 'Not necessarily. When a Major appears naturally, treat it as a spotlight. If none show up, your situation may be more about day-to-day decisions.',
      },
      {
        q: 'Do I need separate upright and reversed pages?',
        a: 'No. Click any card to see upright and reversed meanings on a single, canonical page so link equity is never split.',
      },
      {
        q: 'How do I read multiple Majors in one pull?',
        a: 'Order them by number to see the storyline arc. Early numbers hint at setup energy, while later numbers show culmination and integration.',
      },
      {
        q: 'What is the fastest way to find a Major Arcana card?',
        a: 'Use this suit list in list view for a scannable order, then tap the card name to open the full meaning page.',
      },
    ],
  },
  wands: {
    name: 'Wands',
    slug: 'wands',
    path: '/tarot-card-meanings/wands',
    title: 'Wands Tarot Card Meanings',
    intro:
      'Wands is the fire suit—sparks of action, creativity, and confidence. It tracks how you start, commit to, and protect your momentum.',
    element: 'Fire',
    themes: ['Action', 'Passion', 'Creative drive'],
    highlights: ['Ace through King · 14 cards', 'Great for timing next steps and career momentum'],
    guide: {
      lead: 'Read Wands when you need momentum, motivation, or a reality check on why energy is stalling.',
      steps: [
        {
          title: 'Trace the flame',
          text: 'Ace and Two spark ideas. Three through Six show growth and recognition. Ten and court cards show how you steward or overextend the flame.',
        },
        {
          title: 'Pair with body cues',
          text: 'Notice your physical response to the card—tingle, excitement, tension. It mirrors where your drive is blocked or ready.',
        },
        {
          title: 'Check the fuel source',
          text: 'Is the motivation intrinsic (Ace, Page) or external validation (Six)? Align with the source that sustains you.',
        },
      ],
    },
    faqLead: 'Keep Wands interpretations consistent across upright and reversed meanings.',
    faqs: [
      {
        q: 'What questions fit the Wands suit?',
        a: 'Anything about initiative, career momentum, creative direction, launching, or recovering enthusiasm.',
      },
      {
        q: 'How do I order the Wands cards?',
        a: 'Use the canonical Ace → Ten sequence, then Page, Knight, Queen, and King.',
      },
      {
        q: 'Do Wands always mean yes?',
        a: 'They lean toward action, but reversed Wands can flag burnout, impatience, or misdirected effort.',
      },
      {
        q: 'How do I skim meanings fast?',
        a: 'Switch to list view, scan the card names in order, and tap the one you need—no reversed URL required.',
      },
    ],
  },
  cups: {
    name: 'Cups',
    slug: 'cups',
    path: '/tarot-card-meanings/cups',
    title: 'Cups Tarot Card Meanings',
    intro:
      'Cups is the water suit of feelings, intuition, and relationships. It reveals how you give, receive, and refill emotional energy.',
    element: 'Water',
    themes: ['Feelings', 'Intuition', 'Relationships'],
    highlights: ['Ace through King · 14 cards', 'Perfect for love spreads and emotional check-ins'],
    guide: {
      lead: 'Use Cups when you need clarity on connection, empathy, and emotional boundaries.',
      steps: [
        {
          title: 'Follow the tide',
          text: 'Ace to Three show openings and community. Four through Seven test satisfaction and vision. Ten and courts teach mature emotional flow.',
        },
        {
          title: 'Name the feeling word',
          text: 'Assign one feeling to each pull—curious, content, restless, guarded—to keep readings grounded.',
        },
        {
          title: 'Check reciprocity',
          text: 'Ask whether energy is mutual or one-sided. Cups cards highlight where to pour back into yourself.',
        },
      ],
    },
    faqLead: 'Answer relationship and intuition questions without splitting meaning URLs.',
    faqs: [
      {
        q: 'Are Cups only about romance?',
        a: 'No. They cover all emotional exchanges—family, friendship, creative fulfillment, and spiritual trust.',
      },
      {
        q: 'What if a Cups card feels heavy?',
        a: 'Reversed or challenging Cups point to stuck feelings. Note the emotion, then choose one supportive action to move the water.',
      },
      {
        q: 'Which Cups card starts the story?',
        a: 'Ace of Cups introduces new emotional flow. In list view you can see how it evolves through the suit.',
      },
      {
        q: 'Why keep one canonical link?',
        a: 'Every Cups card opens a single page with upright and reversed meanings together, preventing duplicate URLs.',
      },
    ],
  },
  swords: {
    name: 'Swords',
    slug: 'swords',
    path: '/tarot-card-meanings/swords',
    title: 'Swords Tarot Card Meanings',
    intro:
      'Swords is the air suit of mindset, truth, and decisions. It shows how thoughts cut through fog—or create it.',
    element: 'Air',
    themes: ['Mindset', 'Truth', 'Decisions'],
    highlights: ['Ace through King · 14 cards', 'Ideal for clarity, communication, and conflict resolution'],
    guide: {
      lead: 'Use Swords to diagnose thinking patterns and communication styles before choosing a path.',
      steps: [
        {
          title: 'Track the story arc',
          text: 'Ace plants a thought. Two through Five reveal tension and choice. Nine, Ten, and courts show how to cut cords and reclaim clarity.',
        },
        {
          title: 'Translate fear into facts',
          text: 'Name the belief attached to the card. Replace spiraling thoughts with one grounded statement you can test.',
        },
        {
          title: 'Balance head and heart',
          text: 'Pair Swords pulls with Cups or Wands cards in the spread to keep decisions aligned with emotion and action.',
        },
      ],
    },
    faqLead: 'Keep clarity-first interpretations in one canonical Swords library.',
    faqs: [
      {
        q: 'Do Swords always mean conflict?',
        a: 'They can. But they also represent truth-telling, contracts, and boundary setting—the tools that resolve conflict.',
      },
      {
        q: 'How should I read challenging Swords cards?',
        a: 'Look for the thought pattern. Then identify the smallest verifiable action—one conversation, one boundary—that shifts the story.',
      },
      {
        q: 'What order should I learn them?',
        a: 'Follow Ace → Ten, then Page, Knight, Queen, King. The list view here keeps that order clear.',
      },
      {
        q: 'Do I need separate reversed links?',
        a: 'No. Every card page combines upright and reversed meanings to avoid splitting SEO value.',
      },
    ],
  },
  pentacles: {
    name: 'Pentacles',
    slug: 'pentacles',
    path: '/tarot-card-meanings/pentacles',
    title: 'Pentacles Tarot Card Meanings',
    intro:
      'Pentacles is the earth suit of money, body, and sustainable growth. It shows how you build resources and security over time.',
    element: 'Earth',
    themes: ['Money', 'Work', 'Security'],
    highlights: ['Ace through King · 14 cards', 'Great for career, health, and long-term planning'],
    guide: {
      lead: 'Ask Pentacles about pacing: what deserves patience, investment, or a healthier routine?',
      steps: [
        {
          title: 'Plot the harvest cycle',
          text: 'Ace and Two plant the seed. Three through Seven track skill and effort. Nine, Ten, and courts show legacy and stewardship.',
        },
        {
          title: 'Measure effort vs reward',
          text: 'Notice where you overwork (Five, Seven) or enjoy returns (Nine, Ten). Adjust habits accordingly.',
        },
        {
          title: 'Ground the advice',
          text: 'Translate every pull into one tangible action—budget tweak, body care, or boundary—that protects your resources.',
        },
      ],
    },
    faqLead: 'Read money and wellbeing questions without splitting upright and reversed URLs.',
    faqs: [
      {
        q: 'Are Pentacles only about money?',
        a: 'They cover all material resources—finances, body, time, skills, and the environments that support growth.',
      },
      {
        q: 'What order do Pentacles cards follow?',
        a: 'Ace through Ten, then Page, Knight, Queen, King. This page lists them in that exact order for quick scanning.',
      },
      {
        q: 'How do I read a reversed Pentacles card?',
        a: 'Click the card to see upright and reversed interpretations together. Reversed often flags misaligned effort or scarcity beliefs.',
      },
      {
        q: 'Which spreads pair well with Pentacles?',
        a: 'Career, money, health, or habit-tracking spreads—anything requiring steady, practical guidance.',
      },
    ],
  },
};

const SUIT_COPY_TH = {
  major: {
    name: 'เมเจอร์ อาร์คานา',
    slug: 'major',
    path: '/th/tarot-card-meanings/major',
    title: 'ความหมายไพ่เมเจอร์ อาร์คานา',
    intro:
      'เมเจอร์ อาร์คานา คือการเดินทางของชีวิตผ่านไพ่ 22 ใบ แต่ละใบบอกเล่าจุดเปลี่ยนสำคัญ — การตื่นรู้ บทท้าทาย และการเติบโต — ที่ส่งผลกระทบต่อทุกมิติของชีวิต',
    element: 'ทุกธาตุ',
    themes: ['ต้นแบบชีวิต', 'บทเรียนจิตวิญญาณ', 'จุดเปลี่ยนโชคชะตา'],
    highlights: ['หมายเลข 0–21 · จากคนโง่ถึงโลก', 'ใช้เมื่อต้องการเห็นภาพรวมของการอ่าน'],
    guide: {
      lead: 'ตั้งคำถามใหญ่และลึก ไพ่ชุดนี้บ่งชี้จุดเปลี่ยนสำคัญและเชื่อมโยงอดีต ปัจจุบัน อนาคต',
      steps: [
        {
          title: 'อ่านบทของชีวิต',
          text: 'สังเกตว่าไพ่บ่งบอกการเริ่มต้น (คนโง่ นักมายากล) จุดกึ่งกลาง (ความแข็งแกร่ง ความตาย) หรือบทสรุป (การพิพากษา โลก)',
        },
        {
          title: 'จับบทเรียนให้ได้',
          text: 'เชื่อมไพ่กับคำถามของคุณ: ความเชื่อ ทางเลือก หรือสิ่งที่ต้องปล่อยวางในตอนนี้คืออะไร?',
        },
        {
          title: 'นำไปใช้จริง',
          text: 'สรุปแสงและเงาของไพ่ในหนึ่งประโยคที่ลงมือทำได้วันนี้',
        },
      ],
    },
    faqLead: 'คำถามที่พบบ่อยเกี่ยวกับการอ่านไพ่ 22 ต้นแบบ',
    faqs: [
      {
        q: 'เมเจอร์ อาร์คานา ต่างจากไพ่ชุดอื่นอย่างไร?',
        a: 'ไพ่ชุดนี้บอกเล่าการเดินทางหลักของชีวิต — อัตลักษณ์ คุณค่า การเติบโตทางจิตวิญญาณ — ต่างจากไมเนอร์ที่ว่าด้วยเรื่องรายวัน เช่น งาน ความรัก การเงิน',
      },
      {
        q: 'จำเป็นต้องมีไพ่เมเจอร์ในทุกไพ่สเปรดไหม?',
        a: 'ไม่จำเป็น ถ้าเมเจอร์โผล่มาเองให้ถือว่าเป็นสัญญาณสำคัญ ถ้าไม่มีเลย แปลว่าสถานการณ์อาจเกี่ยวกับการตัดสินใจในชีวิตประจำวัน',
      },
      {
        q: 'ต้องอ่านไพ่ตั้งตรงและกลับหัวแยกกันไหม?',
        a: 'ไม่ต้อง กดเข้าไพ่แต่ละใบจะเห็นความหมายทั้งสองด้านในหน้าเดียว',
      },
      {
        q: 'ถ้าออกมาหลายใบเมเจอร์พร้อมกันอ่านอย่างไร?',
        a: 'เรียงตามหมายเลขเพื่อดูเส้นเรื่อง ตัวเลขต้นๆ บ่งถึงพลังเริ่มต้น ตัวเลขสูงบ่งถึงบทสรุปและการผสานรวม',
      },
      {
        q: 'หาไพ่ที่ต้องการเร็วที่สุดได้อย่างไร?',
        a: 'ใช้มุมมองรายการเพื่อสแกนลำดับไพ่ แล้วกดชื่อเพื่อเข้าหน้าความหมายเต็ม',
      },
    ],
  },
  wands: {
    name: 'ไม้เท้า',
    slug: 'wands',
    path: '/th/tarot-card-meanings/wands',
    title: 'ความหมายไพ่ไม้เท้า',
    intro:
      'ไม้เท้า คือชุดธาตุไฟแห่งแรงบันดาลใจ ความกล้าลงมือ และพลังสร้างสรรค์ บอกเล่าวิธีที่คุณจุดไฟ ลุยหน้า และสร้างสรรค์สิ่งใหม่',
    element: 'ไฟ',
    themes: ['แรงบันดาลใจ', 'การลงมือทำ', 'พลังสร้างสรรค์'],
    highlights: ['เอซถึงคิง · 14 ใบ', 'เหมาะสำหรับคำถามด้านอาชีพ โปรเจกต์ และพลังงานส่วนตัว'],
    guide: {
      lead: 'ใช้ไพ่ไม้เท้าเมื่อต้องการความชัดเจนด้านทิศทาง แรงผลักดัน และการตัดสินใจลงมือทำ',
      steps: [
        {
          title: 'จับไฟที่กำลังลุก',
          text: 'เอซถึงสามบ่งถึงแนวคิดใหม่และการขยาย สี่ถึงเจ็ดทดสอบความมุ่งมั่นและการแข่งขัน สิบและไพ่ราชสำนักสอนการบริหารพลังงานระยะยาว',
        },
        {
          title: 'ถามว่าพลังงานนั้นเป็นของคุณจริงไหม',
          text: 'ไพ่ไม้เท้าชี้ว่าคุณกำลังไล่ตามเป้าหมายของตัวเองหรือเป้าหมายของคนอื่น ระบุแหล่งที่มาของแรงจูงใจให้ชัดเจน',
        },
        {
          title: 'หาก้าวถัดไปหนึ่งก้าว',
          text: 'แปลพลังงานในไพ่เป็นการกระทำที่เล็กที่สุดและเป็นรูปธรรมที่สุดที่ทำได้ในวันนี้',
        },
      ],
    },
    faqLead: 'คำถามที่พบบ่อยเกี่ยวกับไพ่ไม้เท้าและพลังงานสร้างสรรค์',
    faqs: [
      {
        q: 'ไพ่ไม้เท้าเกี่ยวกับงานอย่างเดียวไหม?',
        a: 'ไม่ใช่ ครอบคลุมทุกสิ่งที่ต้องการพลังงานและแรงผลักดัน ทั้งโปรเจกต์ส่วนตัว ความสัมพันธ์ที่ต้องการความกล้า และการเติบโตทางจิตวิญญาณ',
      },
      {
        q: 'ถ้าไพ่ไม้เท้าที่ออกมารู้สึกหนักใจควรทำอย่างไร?',
        a: 'อาจบ่งถึงพลังงานที่ถูกกดไว้หรือการไล่ตามสิ่งผิดทิศ ลองหยุดพักแล้วถามตัวเองว่าอะไรที่ยังจุดประกายความตื่นเต้นอยู่จริงๆ',
      },
      {
        q: 'ไพ่ใบไหนเริ่มต้นเรื่องของชุดไม้เท้า?',
        a: 'เอซไม้เท้าคือประกายแรกของแรงบันดาลใจ มุมมองรายการช่วยให้เห็นว่าพลังนั้นพัฒนาและถูกทดสอบอย่างไรตลอดทั้งชุด',
      },
      {
        q: 'ทำไมต้องใช้ลิงก์เดียว?',
        a: 'ไพ่ทุกใบในชุดไม้เท้าเปิดหน้าเดียวที่มีความหมายทั้งตั้งตรงและกลับหัว ไม่กระจาย URL',
      },
    ],
  },
  cups: {
    name: 'ถ้วย',
    slug: 'cups',
    path: '/th/tarot-card-meanings/cups',
    title: 'ความหมายไพ่ถ้วย',
    intro:
      'ถ้วย คือชุดธาตุน้ำแห่งความรู้สึก สัญชาตญาณ และความสัมพันธ์ บอกเล่าวิธีที่คุณให้ รับ และเติมเต็มพลังงานทางอารมณ์',
    element: 'น้ำ',
    themes: ['ความรู้สึก', 'สัญชาตญาณ', 'ความสัมพันธ์'],
    highlights: ['เอซถึงคิง · 14 ใบ', 'เหมาะสำหรับไพ่สเปรดด้านความรักและการเช็กอารมณ์'],
    guide: {
      lead: 'ใช้ไพ่ถ้วยเมื่อต้องการความชัดเจนด้านการเชื่อมต่อ ความเห็นอกเห็นใจ และขอบเขตทางอารมณ์',
      steps: [
        {
          title: 'ตามกระแสน้ำ',
          text: 'เอซถึงสามบ่งถึงการเปิดใหม่และชุมชน สี่ถึงเจ็ดทดสอบความพึงพอใจและวิสัยทัศน์ สิบและไพ่ราชสำนักสอนการไหลของอารมณ์ที่เติบโตแล้ว',
        },
        {
          title: 'ตั้งชื่อความรู้สึก',
          text: 'กำหนดคำอธิบายความรู้สึกหนึ่งคำให้กับแต่ละไพ่ — อยากรู้ สงบ กระสับกระส่าย ระวัง — เพื่อให้การอ่านจับต้องได้',
        },
        {
          title: 'เช็กความสมดุล',
          text: 'ถามว่าพลังงานนั้นเป็นสองทางหรือฝ่ายเดียว ไพ่ถ้วยชี้ให้เห็นจุดที่ควรหันกลับมาเติมให้ตัวเอง',
        },
      ],
    },
    faqLead: 'คำถามที่พบบ่อยเกี่ยวกับไพ่ถ้วยและการอ่านด้านอารมณ์',
    faqs: [
      {
        q: 'ไพ่ถ้วยเกี่ยวกับความรักอย่างเดียวไหม?',
        a: 'ไม่ใช่ ครอบคลุมการแลกเปลี่ยนทางอารมณ์ทุกรูปแบบ ทั้งครอบครัว มิตรภาพ ความสำเร็จด้านความคิดสร้างสรรค์ และความไว้วางใจทางจิตวิญญาณ',
      },
      {
        q: 'ถ้าไพ่ถ้วยที่ออกมารู้สึกหนักใจควรทำอย่างไร?',
        a: 'ไพ่กลับหัวหรือไพ่ที่ท้าทายบ่งถึงอารมณ์ที่ค้างอยู่ จดบันทึกความรู้สึกนั้น แล้วเลือกลงมือทำสิ่งสนับสนุนตัวเองหนึ่งอย่าง',
      },
      {
        q: 'ไพ่ใบไหนเริ่มต้นเรื่องของชุดถ้วย?',
        a: 'เอซถ้วยเปิดพลังงานอารมณ์ใหม่ มุมมองรายการช่วยให้เห็นว่าพลังนั้นพัฒนาไปอย่างไรตลอดทั้งชุด',
      },
      {
        q: 'ทำไมต้องใช้ลิงก์เดียว?',
        a: 'ไพ่ทุกใบในชุดถ้วยเปิดหน้าเดียวที่มีความหมายทั้งตั้งตรงและกลับหัว ไม่กระจาย URL',
      },
    ],
  },
  swords: {
    name: 'ดาบ',
    slug: 'swords',
    path: '/th/tarot-card-meanings/swords',
    title: 'ความหมายไพ่ดาบ',
    intro:
      'ดาบ คือชุดธาตุลมแห่งความคิด เหตุผล และการตัดสินใจ บอกเล่าวิธีที่คุณวิเคราะห์ สื่อสาร และรับมือกับความขัดแย้ง',
    element: 'ลม',
    themes: ['ความคิด', 'เหตุผล', 'การตัดสินใจ'],
    highlights: ['เอซถึงคิง · 14 ใบ', 'เหมาะสำหรับคำถามด้านความขัดแย้ง การสื่อสาร และความชัดเจนในใจ'],
    guide: {
      lead: 'ใช้ไพ่ดาบเมื่อต้องการตัดสินใจ เคลียร์ความคิด หรือเข้าใจสถานการณ์ที่ซับซ้อน',
      steps: [
        {
          title: 'อ่านความคมของใบมีด',
          text: 'เอซถึงสามบ่งถึงความชัดเจนและการสื่อสาร สี่ถึงเจ็ดทดสอบความขัดแย้งและการฟื้นตัว สิบและไพ่ราชสำนักสอนวิธีใช้ความคิดอย่างเชี่ยวชาญ',
        },
        {
          title: 'แยกความจริงออกจากเรื่องเล่า',
          text: 'ไพ่ดาบมักสะท้อนความคิดที่ตัวเองสร้างขึ้น ถามว่าสิ่งที่คิดอยู่นั้นเป็นข้อเท็จจริงหรือแค่การตีความ',
        },
        {
          title: 'ตัดสินใจให้ชัด',
          text: 'แปลความคมของไพ่เป็นการตัดสินใจหรือการสื่อสารที่ชัดเจนหนึ่งอย่างที่ค้างอยู่',
        },
      ],
    },
    faqLead: 'คำถามที่พบบ่อยเกี่ยวกับไพ่ดาบและการอ่านด้านความคิด',
    faqs: [
      {
        q: 'ไพ่ดาบหมายความว่าจะมีเรื่องไม่ดีเกิดขึ้นไหม?',
        a: 'ไม่จำเป็น ดาบบ่งถึงความชัดเจนและการตัดสินใจ ไพ่ที่ดูรุนแรงมักชี้ให้เห็นความจริงที่ต้องเผชิญ ไม่ใช่ผลลัพธ์ที่หลีกเลี่ยงไม่ได้',
      },
      {
        q: 'ทำไมไพ่ดาบถึงรู้สึกหนักใจบ่อยกว่าชุดอื่น?',
        a: 'เพราะดาบสะท้อนความคิดและความขัดแย้งที่เราหลีกเลี่ยงอยู่ ความไม่สบายใจคือสัญญาณที่ควรใส่ใจ ไม่ใช่สิ่งที่ต้องกลัว',
      },
      {
        q: 'ไพ่ใบไหนเริ่มต้นเรื่องของชุดดาบ?',
        a: 'เอซดาบคือแสงแห่งความชัดเจนครั้งแรก มุมมองรายการช่วยให้เห็นว่าความคิดนั้นพัฒนาและถูกทดสอบอย่างไรตลอดทั้งชุด',
      },
      {
        q: 'ทำไมต้องใช้ลิงก์เดียว?',
        a: 'ไพ่ทุกใบในชุดดาบเปิดหน้าเดียวที่มีความหมายทั้งตั้งตรงและกลับหัว ไม่กระจาย URL',
      },
    ],
  },
  pentacles: {
    name: 'เหรียญ',
    slug: 'pentacles',
    path: '/th/tarot-card-meanings/pentacles',
    title: 'ความหมายไพ่เหรียญ',
    intro:
      'เหรียญ คือชุดธาตุดินแห่งเรื่องเงิน ร่างกาย และความมั่นคง บอกเล่าวิธีที่คุณสร้าง รักษา และเพิ่มพูนสิ่งที่จับต้องได้ในชีวิต',
    element: 'ดิน',
    themes: ['การเงิน', 'ร่างกาย', 'ความมั่นคง'],
    highlights: ['เอซถึงคิง · 14 ใบ', 'เหมาะสำหรับคำถามด้านการเงิน สุขภาพ และการสร้างรากฐาน'],
    guide: {
      lead: 'ใช้ไพ่เหรียญเมื่อต้องการความชัดเจนด้านทรัพยากร ร่างกาย และแผนระยะยาว',
      steps: [
        {
          title: 'ดูว่าดินแน่นแค่ไหน',
          text: 'เอซถึงสามบ่งถึงโอกาสใหม่และการวางรากฐาน สี่ถึงเจ็ดทดสอบการรักษาและการเติบโต สิบและไพ่ราชสำนักสอนการบริหารความมั่งคั่งระยะยาว',
        },
        {
          title: 'ตรวจรากฐาน',
          text: 'ไพ่เหรียญถามว่าความมั่นคงที่คุณสร้างอยู่นั้นตั้งอยู่บนสิ่งที่ยั่งยืนจริงไหม ระบุหนึ่งจุดที่แข็งแกร่งและหนึ่งจุดที่ต้องเสริม',
        },
        {
          title: 'ลงมือจริง',
          text: 'แปลข้อความในไพ่เป็นการกระทำที่จับต้องได้และวัดผลได้หนึ่งอย่างที่ทำได้ในสัปดาห์นี้',
        },
      ],
    },
    faqLead: 'คำถามที่พบบ่อยเกี่ยวกับไพ่เหรียญและการอ่านด้านการเงิน',
    faqs: [
      {
        q: 'ไพ่เหรียญเกี่ยวกับเงินอย่างเดียวไหม?',
        a: 'ไม่ใช่ ครอบคลุมทุกสิ่งที่จับต้องได้ ทั้งสุขภาพ บ้าน งาน และการลงทุนในตัวเอง',
      },
      {
        q: 'ถ้าไพ่เหรียญที่ออกมาบ่งถึงความขาดแคลนควรทำอย่างไร?',
        a: 'มองหาทรัพยากรที่มีอยู่แล้วแต่ยังไม่ได้ใช้ประโยชน์เต็มที่ ไพ่เหรียญมักชี้ทางออกที่เป็นรูปธรรมเสมอ',
      },
      {
        q: 'ไพ่ใบไหนเริ่มต้นเรื่องของชุดเหรียญ?',
        a: 'เอซเหรียญคือของขวัญจากจักรวาล — โอกาสใหม่ที่จับต้องได้ มุมมองรายการช่วยให้เห็นว่าโอกาสนั้นพัฒนาและสร้างผลอย่างไรตลอดทั้งชุด',
      },
      {
        q: 'ทำไมต้องใช้ลิงก์เดียว?',
        a: 'ไพ่ทุกใบในชุดเหรียญเปิดหน้าเดียวที่มีความหมายทั้งตั้งตรงและกลับหัว ไม่กระจาย URL',
      },
    ],
  },
};

const isThaiPage =
  document.documentElement?.lang === 'th' ||
  window.location.pathname.startsWith('/th/');

const state = {
  suitKey: 'major',
  cards: [],
  view: 'grid',
};

initShell(state, null, document.body?.dataset?.page || 'meanings');

function detectSuit() {
  const bodySuit = document.body?.dataset?.suit;
  if (bodySuit && SUIT_COPY[bodySuit]) return bodySuit;

  const match = window.location.pathname.match(/tarot-card-meanings\/(major|wands|cups|swords|pentacles)/i);
  if (match && SUIT_COPY[match[1]]) return match[1];
  return 'major';
}

function getCardNumber(card) {
  const raw = card.card_id || card.id || '';
  const match = raw.match(/^(\d{2})/);
  return match ? parseInt(match[1], 10) : null;
}

function getSuitCards(cards, suitKey) {
  const range = SUIT_RANGES[suitKey];
  if (!range) return [];
  return cards
    .filter((card) => {
      const num = getCardNumber(card);
      const orientation = (card.orientation || '').toLowerCase();
      return num && num >= range.start && num <= range.end && orientation !== 'reversed';
    })
    .sort((a, b) => (getCardNumber(a) || 0) - (getCardNumber(b) || 0));
}

function buildCardHref(card) {
  const slug = card.seo_slug_en || normalizeId(card.card_name_en || card.name_en || card.name || card.id);
  const lang = isThaiPage ? 'th' : 'en';
  const fallback = isThaiPage ? `/th/cards/${normalizeId(slug)}/` : `/cards/${normalizeId(slug)}/`;
  return getCanonicalCardPath(slug, lang) || fallback;
}

function getCardSummary(card) {
  if (isThaiPage) {
    return card.reading_summary_preview_th || card.tarot_imply_th || card.meaning_th || '';
  }
  return card.reading_summary_preview_en || card.tarot_imply_en || card.meaning_en || '';
}

function padNumber(num) {
  return String(num || '').padStart(2, '0');
}

function renderCards() {
  const cardContainer = document.getElementById('suitCardList');
  if (!cardContainer) return;
  cardContainer.classList.toggle('is-grid', state.view === 'grid');
  cardContainer.classList.toggle('is-list', state.view === 'list');
  cardContainer.innerHTML = '';

  const range = SUIT_RANGES[state.suitKey];

  state.cards.forEach((card) => {
    const num = getCardNumber(card);
    const relative = num && range ? num - range.start + 1 : null;
    const displayNumber = padNumber(relative || num);

    const cardEl = document.createElement('article');
    cardEl.className = 'suit-card';

    const name = card.card_name_en || card.name_en || card.name || card.id;
    const summary = getCardSummary(card);
    const imageUrl = getCardImageUrl(card, { orientation: 'upright' });
    const altText = card.image_alt_en || `${name} tarot card illustration`;

    cardEl.innerHTML = `
      <a class="suit-card-link" href="${buildCardHref(card)}">
        <div class="suit-card-media" aria-hidden="true">
          <img loading="lazy" src="${imageUrl}" alt="${altText}" />
          <span class="suit-card-number">${displayNumber}</span>
        </div>
        <div class="suit-card-body">
          <p class="suit-card-order">${displayNumber}</p>
          <h3>${name}</h3>
          ${summary ? `<p class="suit-card-summary">${summary}</p>` : ''}
        </div>
      </a>
    `;

    cardContainer.appendChild(cardEl);
  });
}

function renderChips(config, cardCount) {
  const chipRow = document.getElementById('suitChips');
  if (!chipRow) return;

  chipRow.innerHTML = '';
  const chips = [];

  const elementLabel = isThaiPage ? 'ธาตุ' : 'Element';
  const themesLabel = isThaiPage ? 'ธีมหลัก' : 'Core themes';
  const countLabel = isThaiPage ? 'จำนวนไพ่' : 'Card count';
  const countValue = isThaiPage ? `${cardCount} ใบ` : `${cardCount} cards`;

  if (config.element) chips.push({ label: elementLabel, value: config.element });
  if (config.themes?.length) chips.push({ label: themesLabel, value: config.themes.join(' · ') });
  chips.push({ label: countLabel, value: countValue });

  chips.forEach((chip) => {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = `<strong>${chip.label}:</strong> ${chip.value}`;
    chipRow.appendChild(span);
  });
}

function renderHighlights(config) {
  const container = document.getElementById('suitHighlights');
  if (!container) return;
  container.innerHTML = '';

  (config.highlights || []).forEach((text) => {
    const item = document.createElement('div');
    item.className = 'highlight-card';
    item.textContent = text;
    container.appendChild(item);
  });
}

function renderGuide(config) {
  const lead = document.getElementById('guideLead');
  const grid = document.getElementById('guideContent');
  if (lead) lead.textContent = config.guide?.lead || '';
  if (!grid) return;
  grid.innerHTML = '';

  (config.guide?.steps || []).forEach((step) => {
    const card = document.createElement('article');
    card.className = 'guide-card';
    card.innerHTML = `
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    `;
    grid.appendChild(card);
  });
}

function renderFaq(config) {
  const faqTitle = document.getElementById('faqTitle');
  const faqLead = document.getElementById('faqLead');
  const faqList = document.getElementById('faqList');

  if (faqTitle) faqTitle.textContent = isThaiPage ? `คำถามที่พบบ่อยเกี่ยวกับไพ่${config.name}` : `${config.name} FAQs`;
  if (faqLead) faqLead.textContent = config.faqLead || '';
  if (!faqList) return;

  faqList.innerHTML = '';
  (config.faqs || []).forEach((item) => {
    const details = document.createElement('details');
    details.className = 'faq-item';
    details.innerHTML = `
      <summary>${item.q}</summary>
      <p>${item.a}</p>
    `;
    faqList.appendChild(details);
  });
}

function setHero(config, cardCount) {
  const title = document.getElementById('suitTitle');
  const intro = document.getElementById('suitIntro');
  const cardCountEl = document.getElementById('suitCardCount');
  const eyebrow = document.querySelector('[data-suit-eyebrow]');
  const crumb = document.querySelector('[data-suit-crumb]');

  if (title) title.textContent = config.title;
  if (intro) intro.textContent = config.intro;
  if (cardCountEl) cardCountEl.textContent = cardCount;
  if (eyebrow) eyebrow.textContent = isThaiPage ? `คู่มือไพ่${config.name}` : `${config.name} suit guide`;
  if (crumb) crumb.textContent = config.name;

  renderChips(config, cardCount);
  renderHighlights(config);
}

function setViewToggle() {
  const toggles = Array.from(document.querySelectorAll('.view-toggle [data-view]'));
  toggles.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
}

function bindViewToggle() {
  const toggles = Array.from(document.querySelectorAll('.view-toggle [data-view]'));
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view || view === state.view) return;
      state.view = view;
      setViewToggle();
      renderCards();
    });
  });
}

function setSeo(config) {
  const canonicalUrl = `https://www.meowtarot.com${config.path}`;
  const description = isThaiPage
    ? `ความหมายไพ่${config.name}แบบครบ พร้อมความหมายตั้งตรง กลับหัว และค้นหาไพ่อย่างรวดเร็ว`
    : `${config.name} tarot card meanings with canonical upright + reversed guidance, keywords, and a fast card finder.`;
  const title = `${config.title} | MeowTarot`;

  const setContent = (selector, value, attr = 'content') => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  document.title = title;
  setContent('meta[name="description"][data-suit-meta="description"]', description);
  setContent('meta[property="og:title"][data-suit-meta="og-title"]', title);
  setContent('meta[property="og:description"][data-suit-meta="og-description"]', description);
  setContent('meta[property="og:url"][data-suit-meta="og-url"]', canonicalUrl);
  setContent('meta[name="twitter:title"][data-suit-meta="twitter-title"]', title);
  setContent('meta[name="twitter:description"][data-suit-meta="twitter-description"]', description);
  setContent('link[rel="canonical"][data-suit-meta="canonical"]', canonicalUrl, 'href');
  const enUrl = `https://www.meowtarot.com/tarot-card-meanings/${config.slug}`;
  const thUrl = `https://www.meowtarot.com/th/tarot-card-meanings/${config.slug}`;
  setContent('link[rel="alternate"][data-suit-meta="hreflang-en"]', enUrl, 'href');
  setContent('link[rel="alternate"][data-suit-meta="hreflang-th"]', thUrl, 'href');
  setContent('link[rel="alternate"][data-suit-meta="hreflang-x"]', enUrl, 'href');

  const faqEntities = (config.faqs || []).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: isThaiPage ? 'หน้าหลัก' : 'Home',
            item: isThaiPage ? 'https://www.meowtarot.com/th/' : 'https://www.meowtarot.com/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: isThaiPage ? 'ความหมายไพ่ทาโรต์' : 'Tarot Card Meanings',
            item: isThaiPage
              ? 'https://www.meowtarot.com/th/tarot-card-meanings/'
              : 'https://www.meowtarot.com/meanings.html',
          },
          { '@type': 'ListItem', position: 3, name: config.name, item: canonicalUrl },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: config.title,
        description,
        about: [
          {
            '@type': 'Thing',
            name: isThaiPage
              ? `ความหมายไพ่${config.name}`
              : `${config.name.toLowerCase()} tarot meanings`,
          },
          {
            '@type': 'Thing',
            name: isThaiPage ? `ชุดไพ่${config.name}` : `${config.name} suit`,
          },
        ],
        inLanguage: isThaiPage ? 'th' : 'en',
        isPartOf: { '@id': 'https://www.meowtarot.com/#website' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: faqEntities,
      },
    ],
  };

  const schemaEl = document.getElementById('suit-schema');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema, null, 2);
}

function init() {
  state.suitKey = detectSuit();
  const copyTable = isThaiPage ? SUIT_COPY_TH : SUIT_COPY;
  const config = copyTable[state.suitKey] || copyTable.major;

  bindViewToggle();
  setViewToggle();
  setSeo(config);

  loadTarotData()
    .then(() => {
      state.cards = getSuitCards(meowTarotCards, state.suitKey);
      setHero(config, state.cards.length);
      renderGuide(config);
      renderFaq(config);
      renderCards();
    })
    .catch((err) => {
      console.error('Failed to load suit cards', err);
    });
}

init();
