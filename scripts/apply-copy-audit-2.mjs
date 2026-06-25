import fs from 'fs';
import path from 'path';

const CARDS_FILE = path.join(process.cwd(), 'data', 'cards.json');
const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));

let c21 = cards.find(c => c.card_id === '21-judgement-upright');
if (c21) {
  c21.self_reading_single_th = c21.self_reading_single_th.replace('ผลัดขนเก่าทิ้งไป', 'ทิ้งตัวตนเก่าๆ ไป');
}

let c25 = cards.find(c => c.card_id === '25-three-of-wands-upright');
if (c25) {
  c25.hook_th = c25.hook_th.replace('เหมียวผู้ฉลาด', 'คนที่ฉลาด');
}

fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2) + '\n');
console.log('Applied additional fixes.');
