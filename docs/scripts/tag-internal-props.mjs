// Adds @internal to the comment above each listed prop in a documented component's propTypes,
// so the docs site hides it. Safe to re-run: props already tagged are skipped.
//
//   node scripts/tag-internal-props.mjs internal-props.json
//
// internal-props.json is an array of { "component": "DataMessenger", "prop": "enableDPRTab" }.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCUMENTED_COMPONENTS } from './components.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

// Returns the [start, end) line range of the propTypes object literal, or null.
function propTypesRange(lines) {
  const start = lines.findIndex((l) => /^\s*(static\s+propTypes\s*=|\w+\.propTypes\s*=)\s*\{\s*$/.test(l))
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i].replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) {
      if (ch === '{' || ch === '(' || ch === '[') depth++
      else if (ch === '}' || ch === ')' || ch === ']') depth--
    }
    if (depth <= 0) return [start, i + 1]
  }
  return null
}

function tag(lines, prop) {
  const range = propTypesRange(lines)
  if (!range) return 'no propTypes'
  const propIndent = lines[range[0] + 1]?.match(/^\s*/)[0] ?? '    '
  const i = lines.findIndex(
    (l, n) =>
      n > range[0] && n < range[1] && l.startsWith(propIndent) && new RegExp(`^${propIndent}${prop}\\s*:`).test(l),
  )
  if (i < 0) return 'not in propTypes'
  const indent = lines[i].match(/^\s*/)[0]
  const above = lines[i - 1]
  if (/^\s*\/\*\*.*\*\/\s*$/.test(above)) {
    // One-line /** text */
    if (above.includes('@internal')) return 'already tagged'
    lines[i - 1] = above.replace('/** ', '/** @internal ')
    return 'tagged'
  }
  if (/^\s*\*\/\s*$/.test(above)) {
    // Multi-line block: find its opening /** and add a tag line after it.
    let j = i - 1
    while (j > 0 && !/^\s*\/\*\*\s*$/.test(lines[j])) j--
    if (lines.slice(j, i).some((l) => l.includes('@internal'))) return 'already tagged'
    lines.splice(j + 1, 0, `${indent} * @internal`)
    return 'tagged'
  }
  lines.splice(i, 0, `${indent}/** @internal */`)
  return 'tagged'
}

const results = {}
for (const { name, file } of DOCUMENTED_COMPONENTS) {
  const props = list.filter((d) => d.component === name).map((d) => d.prop)
  if (!props.length) continue
  const filename = path.join(repoRoot, file)
  const lines = fs.readFileSync(filename, 'utf8').split('\n')
  for (const prop of props) {
    const outcome = tag(lines, prop)
    ;(results[outcome] ??= []).push(`${name}.${prop}`)
  }
  fs.writeFileSync(filename, lines.join('\n'))
}
for (const [outcome, props] of Object.entries(results)) {
  console.log(`${outcome}: ${props.length}`)
  if (outcome !== 'tagged') console.log('  ' + props.join(', '))
}
