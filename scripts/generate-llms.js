import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const rootDir = path.join(__dirname, '..')
const dataDir = path.join(rootDir, 'data')
const outDir = rootDir

console.log("Generating llms.txt and llms-full.txt for MeowTarot...")

// --- 1. Base llms.txt ---
const baseLlms = `# MeowTarot AI Context
> Free daily cat tarot readings, 3-card spreads, Celtic Cross readings, and tarot card meanings. 

## About Us
MeowTarot is a pocket psychic for cat lovers. We provide intuitive, beautifully illustrated tarot readings focusing on love, career, and personal growth.

## Core Directories
- Card Meanings: https://www.meowtarot.com/tarot-card-meanings/
- Daily Pull: https://www.meowtarot.com/daily.html
- Questions: https://www.meowtarot.com/question.html

## Full Content
You can ingest our entire database of 78 tarot cards (upright/reversed) and meaning interpretations at: https://www.meowtarot.com/llms-full.txt
`

fs.writeFileSync(path.join(outDir, 'llms.txt'), baseLlms)

// --- 2. Full llms-full.txt ---
let fullContent = baseLlms + '\n\n---\n\n# FULL TAROT DATABASE DUMP\n\n'

// Append Cards
fullContent += '## ALL 78 TAROT CARDS\n\n'
try {
  const cards = JSON.parse(fs.readFileSync(path.join(dataDir, 'cards.json'), 'utf8'))
  for (const c of cards) {
    fullContent += `### ${c.name}\n`
    fullContent += `- Suit: ${c.suit}\n`
    fullContent += `- Element: ${c.element || 'N/A'}\n`
    fullContent += `- Upright Keywords: ${c.upright_keywords ? c.upright_keywords.join(', ') : 'N/A'}\n`
    fullContent += `- Reversed Keywords: ${c.reversed_keywords ? c.reversed_keywords.join(', ') : 'N/A'}\n`
    fullContent += `- Description: ${c.description || 'N/A'}\n`
    fullContent += `- Love & Relationships (Upright): ${c.meaning_upright_love || 'N/A'}\n`
    fullContent += `- Career & Finance (Upright): ${c.meaning_upright_career || 'N/A'}\n`
    fullContent += `- Love & Relationships (Reversed): ${c.meaning_reversed_love || 'N/A'}\n`
    fullContent += `- Career & Finance (Reversed): ${c.meaning_reversed_career || 'N/A'}\n`
    fullContent += '\n'
  }
} catch (e) {
  console.log("Could not load cards.json, skipping card dump.");
}

// Append specific Questions
fullContent += '---\n\n## FREQUENTLY ASKED TAROT QUESTIONS\n\n'
try {
  const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8'))
  for (const cat of categories) {
    fullContent += `### Category: ${cat.name}\n`
    for (const q of cat.questions) {
      fullContent += `- ${q.text}\n`
    }
    fullContent += '\n'
  }
} catch (e) {
  console.log("Could not load categories.json, skipping questions dump.");
}

fs.writeFileSync(path.join(outDir, 'llms-full.txt'), fullContent)
console.log("✅ Wrote llms.txt and llms-full.txt")
