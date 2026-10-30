// One-off: turns the // comments directly above props in each documented component's propTypes
// into /** */ comments, which react-docgen reads. Comments elsewhere in the file are left alone.
//
//   node scripts/convert-prop-comments.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCUMENTED_COMPONENTS } from './components.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function convert(source) {
  const lines = source.split('\n')
  const out = []
  let inPropTypes = false
  let depth = 0
  let pending = [] // // comment lines waiting to see whether a prop follows
  let converted = 0

  const flush = () => {
    out.push(...pending.map((p) => p.line))
    pending = []
  }

  for (const line of lines) {
    if (!inPropTypes && /^\s*(static\s+propTypes\s*=|\w+\.propTypes\s*=)\s*\{\s*$/.test(line)) {
      inPropTypes = true
      depth = 1
      out.push(line)
      continue
    }
    if (!inPropTypes) {
      out.push(line)
      continue
    }

    const comment = line.match(/^(\s*)\/\/\s?(.*)$/)
    if (comment && depth === 1) {
      pending.push({ line, indent: comment[1], text: comment[2] })
      continue
    }

    const isProp = depth === 1 && /^\s*[A-Za-z_$][\w$]*\s*:/.test(line)
    // A one-line label of one or two words ("// Global", "// Callbacks") names a group of props.
    const isLabel = pending.length === 1 && /^[A-Z][\w-]*( [\w-]+)?$/.test(pending[0].text.trim())
    if (isProp && pending.length && !isLabel) {
      const indent = pending[0].indent
      const text = pending.map((p) => p.text.trim()).filter(Boolean)
      if (text.length === 1) out.push(`${indent}/** ${text[0]} */`)
      else out.push(`${indent}/**`, ...text.map((t) => `${indent} * ${t}`), `${indent} */`)
      pending = []
      converted++
    } else {
      // A blank line or section label (e.g. "// UI") that is not attached to a prop stays as it was.
      flush()
    }
    out.push(line)

    for (const ch of line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) {
      if (ch === '{' || ch === '(' || ch === '[') depth++
      else if (ch === '}' || ch === ')' || ch === ']') depth--
    }
    if (depth <= 0) inPropTypes = false
  }
  flush()
  return { text: out.join('\n'), converted }
}

for (const { name, file } of DOCUMENTED_COMPONENTS) {
  const filename = path.join(repoRoot, file)
  const { text, converted } = convert(fs.readFileSync(filename, 'utf8'))
  if (converted) fs.writeFileSync(filename, text)
  console.log(`${name.padEnd(18)} ${converted} comment${converted === 1 ? '' : 's'} converted`)
}
