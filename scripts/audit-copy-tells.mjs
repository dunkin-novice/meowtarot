import fs from 'fs';
import path from 'path';

// Define the rule sets
const tellsTH = ['คนเหมียว', 'เหมียว', 'อุ้งเท้า', 'ขนฟู', 'ผลัดขน', 'เสียงครางครือ'];
const tellsEN = ['your meow', 'you meow', 'your fur', 'furry', 'your tail', 'nine lives like you', 'catnip'];

// Excluded false positives where the context is safely external or used correctly
const EXCLUSIONS = [
  '17-the-tower-upright|self_reading_single_th', // Uses cat as a simile: "เปรียบเหมือนแมวผลัดขนเก่าออก"
  '07-the-lovers-upright|meta_description_th',   // Refers to the deck itself: "ไพ่ทาโรต์แมวเหมียว"
  '12-the-hanged-man-reversed|action_prompt_th',  // "ลองมองมุมกลับเหมือนแมวเหมียว"
  '12-the-hanged-man-upright|action_prompt_th',   // "มองในมุมมองของน้องเหมียว"
];

const regexTH = new RegExp('(' + tellsTH.join('|') + ')');
const regexEN = new RegExp('(' + tellsEN.join('|') + ')', 'i');

const CARDS_FILE = path.join(process.cwd(), 'data', 'cards.json');
const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));

let hasErrors = false;
let issues = [];

for (const card of cards) {
  for (const [key, value] of Object.entries(card)) {
    if (typeof value !== 'string') continue;

    const testId = `${card.card_id}|${key}`;
    if (EXCLUSIONS.includes(testId)) continue;

    if (key.endsWith('_th') && regexTH.test(value)) {
      issues.push(`[TH] ${testId} - Found matched tell: "${value}"`);
      hasErrors = true;
    }
    
    if (key.endsWith('_en') && regexEN.test(value)) {
      issues.push(`[EN] ${testId} - Found matched tell: "${value}"`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error('❌ User-as-Cat audit FAILED! Found the following slips:');
  issues.forEach(issue => console.error('  ' + issue));
  console.error('\nPlease fix these in data/cards.json so the reader is addressed as a human.');
  process.exit(1);
} else {
  console.log('✅ User-as-Cat audit passed. No new slips found.');
  process.exit(0);
}
