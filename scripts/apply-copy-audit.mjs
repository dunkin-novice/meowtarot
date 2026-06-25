import fs from 'fs';
import path from 'path';

const CARDS_FILE = path.join(process.cwd(), 'data', 'cards.json');
const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));

const replacements = [
  { id: '54-four-of-swords-upright', field: 'hook_th', search: 'ขนาดคนยังนอนวันละ 16 ชั่วโมง... แล้วมนุษย์อย่างคุณจะฝืนไปทำไม?', replace: 'ขนาดแมวยังนอนวันละ 16 ชั่วโมง... แล้วคุณจะฝืนไปทำไม?' },
  { id: '10-the-hermit-upright', field: 'family_reading_single_th', search: 'ไม่ผิดหรอกที่จะถอยห่างจากดราม่าในครอบครัว คุณยังรักฝูงเหมียวของคุณได้เสมอ แม้จะนั่งมองดูพวกเขาจากบนชั้นวางของที่สูงห่างออกมา', replace: 'ไม่ผิดหรอกที่จะถอยห่างจากดราม่าในครอบครัว คุณยังรักคนในครอบครัวของคุณได้เสมอ แม้จะขอเฝ้ามองพวกเขาอยู่ห่างๆ สักพักก็ตาม' },
  { id: '10-the-hermit-upright', field: 'travel_reading_single_th', search: 'การเดินทางคนเดียวหรือการไปปลีกวิเวกกำลังเรียกหา แพ็คกระเป๋าเบาๆ แล้วไปที่ที่ได้ยินแค่เสียงลมและเสียงครางครือในลำคอของคุณ', replace: 'การเดินทางคนเดียวหรือการไปปลีกวิเวกกำลังเรียกหา แพ็คกระเป๋าเบาๆ แล้วไปที่ที่ได้ยินแค่เสียงลมและเสียงจังหวะของหัวใจตัวเอง' },
  { id: '11-wheel-of-fortune-upright', field: 'career_reading_single_th', search: 'โชคเข้าข้างเหมียวแล้ว! โอกาสที่ไม่คาดคิดหรือการเปลี่ยนแปลงกะทันหันในงานจะนำไปสู่ความสำเร็จ เตรียมตัวปรับเปลี่ยนให้ไว', replace: 'โชคเข้าข้างคุณแล้ว! โอกาสที่ไม่คาดคิดหรือการเปลี่ยนแปลงกะทันหันในงานจะนำไปสู่ความสำเร็จ เตรียมตัวปรับเปลี่ยนให้ไว' },
  { id: '17-the-tower-upright', field: 'health_reading_single_th', search: 'ลองฟังเสียงเตือนเล็กๆ จากร่างกายเพื่อเป็นสัญญาณให้ค่อยๆ ช้าลง อาจเป็นช่วงเวลาที่ควรพักอุ้งเท้าและถนอมพลังงานของตัวเองไว้บ้าง', replace: 'ลองฟังเสียงเตือนเล็กๆ จากร่างกายเพื่อเป็นสัญญาณให้ค่อยๆ ช้าลง อาจเป็นช่วงเวลาที่ควรพักผ่อนและถนอมพลังงานของตัวเองไว้บ้าง' },
  { id: '17-the-tower-upright', field: 'self_reading_single_th', search: 'ทิฐิหรือความเชื่อเดิมๆ อาจถูกทำลายลง แต่นั่นเปรียบเหมือนการผลัดขนเก่าเพื่อรับขนใหม่ที่สวยงามกว่าเดิม จงยอมรับความจริงและปล่อยวางอีโก้', replace: 'ทิฐิหรือความเชื่อเดิมๆ อาจถูกทำลายลง แต่นั่นเปรียบเหมือนแมวผลัดขนเก่าออกเพื่อเผยขนใหม่ที่สวยงามกว่าเดิม จงยอมรับความจริงและปล่อยวางอีโก้' },
  { id: '17-the-tower-upright', field: 'self_reading_single_en', search: 'Your ego might take a hit, but it\'s just the old fur shedding to make way for a shinier coat. Embrace the sudden clarity and let go of false pride.', replace: 'Your ego might take a hit, but it\'s just like a cat shedding its old fur to make way for a shinier coat. Embrace the sudden clarity and let go of false pride.' },
  { id: '22-the-world-upright', field: 'self_reading_single_th', search: 'คุณรู้สึกเติมเต็มและมั่นใจในตัวเองมาก คุณยอมรับทุกด้านของตัวเองได้แล้วไม่ว่าจะดีหรือร้าย และพร้อมที่จะอวดขนฟูๆ ให้โลกได้เห็นความเจ๋งของคุณ', replace: 'คุณรู้สึกเติมเต็มและมั่นใจในตัวเองมาก คุณยอมรับทุกด้านของตัวเองได้แล้วไม่ว่าจะดีหรือร้าย และพร้อมที่จะเปล่งประกายให้โลกได้เห็นความเจ๋งของคุณ' },
  { id: '22-the-world-upright', field: 'family_reading_single_th', search: 'บรรยากาศในบ้านอบอุ่นและลงตัวมาก อาจมีการรวมญาติ หรืองานฉลองความสำเร็จร่วมกัน ทุกคนในครอบครัวคนเหมียวของคุณมีความสุขและเข้าใจกันดี', replace: 'บรรยากาศในบ้านอบอุ่นและลงตัวมาก อาจมีการรวมญาติ หรืองานฉลองความสำเร็จร่วมกัน ทุกคนในครอบครัวของคุณมีความสุขและเข้าใจกันดี' },
  { id: '29-seven-of-wands-upright', field: 'finance_reading_single_th', search: 'หวงขนมของคุณไว้ให้ดี ช่วงนี้ต้องปกป้องทรัพย์สินจากรายจ่ายที่ไม่จำเป็นหรือคนที่มาขอยืมเงิน เอาอุ้งเท้าทับกระเป๋าตังค์ไว้แน่นๆ เลย', replace: 'หวงขนมของคุณไว้ให้ดี ช่วงนี้ต้องปกป้องทรัพย์สินจากรายจ่ายที่ไม่จำเป็นหรือคนที่มาขอยืมเงิน กุมกระเป๋าตังค์ไว้ให้แน่นๆ เลย' },
  { id: '30-eight-of-wands-upright', field: 'career_reading_single_th', search: 'งานเดินหน้าเร็วปานสายฟ้าแลบ! เตรียมรับมือกับอีเมลที่เด้งรัวๆ การตัดสินใจที่ต้องฉับไว หรือการเดินทางไปทำงานแบบปุบปับ ตามให้ทันล่ะคนเหมียว!', replace: 'งานเดินหน้าเร็วปานสายฟ้าแลบ! เตรียมรับมือกับอีเมลที่เด้งรัวๆ การตัดสินใจที่ต้องฉับไว หรือการเดินทางไปทำงานแบบปุบปับ ตามให้ทันล่ะ!' },
  { id: '78-king-of-pentacles-reversed', field: 'finance_reading_single_th', search: 'ช่วงนี้เงินอาจจะไหลออกจากอุ้งเท้าไวไปนิดเพราะอารมณ์ชั่ววูบ ลองกลับมาเช็กดูเบาๆ ว่าอะไรที่จำเป็นจริงๆ หรืออะไรที่เป็นแค่ของล่อใจกันแน่', replace: 'ช่วงนี้เงินอาจจะไหลออกจากอุ้งมือไวไปนิดเพราะอารมณ์ชั่ววูบ ลองกลับมาเช็กดูเบาๆ ว่าอะไรที่จำเป็นจริงๆ หรืออะไรที่เป็นแค่ของล่อใจกันแน่' },
  { id: '09-strength-reversed', field: 'career_reading_single_en', search: 'Imposter syndrome might be sneaking in, making you feel smaller than your role. Don\'t force yourself to roar if you only have a meow right now; handle small tasks first.', replace: 'Imposter syndrome might be sneaking in, making you feel smaller than your role. Don\'t force yourself to roar like a lion when your voice is still a whisper; handle small tasks first.' },
  { id: '28-six-of-wands-reversed', field: 'family_reading_single_en', search: 'There might be some tension regarding who\'s \'in charge.\' Soften your meow and practice listening more than leading to keep the peace.', replace: 'There might be some tension regarding who\'s \'in charge.\' Soften your tone and practice listening more than leading to keep the peace.' },
  { id: '31-nine-of-wands-upright', field: 'hook_en', search: 'A person with nine lives like you... doesn\'t go down easily. Get up!', replace: 'Someone as resilient as you, with nine lives\' worth of grit... doesn\'t go down easily. Get up!' },
  { id: '31-nine-of-wands-upright', field: 'hook_th', search: 'คนเก้าชีวิตอย่างคุณ... ไม่มีคำว่า \'ตาย\' ง่ายๆ หรอกนะ ลุกขึ้นมา!', replace: 'คนที่อึดเหมือนมีเก้าชีวิตอย่างคุณ... ไม่มีคำว่า \'ตาย\' ง่ายๆ หรอกนะ ลุกขึ้นมา!' },
  { id: '32-ten-of-wands-reversed', field: 'self_reading_single_en', search: 'You\'ve been carrying too much emotional weight lately. It is perfectly okay to put the logs down and just rest for a while; you don\'t have to carry the world on your furry shoulders.', replace: 'You\'ve been carrying too much emotional weight lately. It is perfectly okay to put the logs down and just rest for a while; you don\'t have to carry the world on your shoulders.' },
  { id: '33-page-of-wands-reversed', field: 'family_present_en', search: 'A lack of communication might make things feel a bit tense; try to listen as much as you meow.', replace: 'A lack of communication might make things feel a bit tense; try to listen as much as you speak.' },
  { id: '07-the-lovers-upright', field: 'hook_th', search: 'ซ้ายหรือขวา? หัวใจหรือสมอง? ทางไหนคือทางของคนเหมียวกันนะ?', replace: 'ซ้ายหรือขวา? หัวใจหรือสมอง? ทางไหนคือทางของใจคุณกันนะ?' },
  { id: '15-temperance-upright', field: 'hook_th', search: 'ไม่ร้อนไป ไม่เย็นไป... ความพอดีนี่แหละคือสุดยอดวิชาของคนเหมียว', replace: 'ไม่ร้อนไป ไม่เย็นไป... ความพอดีนี่แหละคือสุดยอดวิชาของชีวิต' },
  { id: '03-the-high-priestess-reversed', field: 'self_past_en', search: 'You may have spent time suppressing your true nature to fit in, silencing your inner meow.', replace: 'You may have spent time suppressing your true nature to fit in, silencing your inner voice.' },
  { id: '23-ace-of-wands-reversed', field: 'family_reading_single_en', search: 'The home energy feels a bit like a rainy afternoon—quiet and perhaps a little lonely. Don\'t force a \'meow\' if you\'re not ready; gentle presence is enough.', replace: 'The home energy feels a bit like a rainy afternoon—quiet and perhaps a little lonely. Don\'t force the conversation if you\'re not ready; gentle presence is enough.' },
  { id: '33-page-of-wands-reversed', field: 'family_future_en', search: 'Peace returns when everyone stops acting like stubborn kittens and starts taking shared responsibilities seriously.', replace: 'Peace returns when everyone stops acting so stubbornly and starts taking shared responsibilities seriously.' },
  { id: '55-five-of-swords-reversed', field: 'celtic_cross_challenge_en', search: 'The challenge is the stubborn refusal to let the grudge go; a tail-twitching desire to have the last word is keeping the wound from healing.', replace: 'The challenge is the stubborn refusal to let the grudge go; a restless, itching desire to have the last word is keeping the wound from healing.' },
  { id: '45-nine-of-cups-upright', field: 'finance_reading_single_en', search: 'Your finances are looking incredibly plush; feel free to treat yourself to that premium catnip or whatever makes you feel like royalty.', replace: 'Your finances are looking incredibly plush; feel free to treat yourself to that premium indulgence or whatever makes you feel like royalty.' }
];

let applied = 0;
for (const rep of replacements) {
  const card = cards.find(c => c.card_id === rep.id);
  if (!card) {
    console.error('Card not found:', rep.id);
    continue;
  }
  if (card[rep.field] === rep.search) {
    card[rep.field] = rep.replace;
    applied++;
  } else if (card[rep.field] === rep.replace) {
    console.log('Already applied:', rep.id, rep.field);
  } else {
    console.error('Mismatch on', rep.id, rep.field);
    console.error('  Expected:', rep.search);
    console.error('  Actual  :', card[rep.field]);
  }
}

fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2) + '\n');
console.log('Applied', applied, 'fixes.');
