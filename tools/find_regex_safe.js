const fs = require('fs')
const path = require('path')

function walkSync(dir, filelist = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fp = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSync(fp, filelist)
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      filelist.push(fp)
    }
  }
  return filelist
}

function findRegexLiterals(content) {
  // simple heuristic: look for /.../ with at least one non-slash inside
  const regex = /(^|[^\\])\/([^\n\/]{3,})\/([gimsuy]{0,6})/g
  const matches = []
  let m
  while ((m = regex.exec(content)) !== null) {
    matches.push({ match: m[0], index: m.index })
  }
  return matches
}

const base = path.resolve(process.cwd(), '..', 'autoql-fe-utils', 'src')
const files = walkSync(base)
let total = 0
for (const file of files) {
  try {
    const stat = fs.statSync(file)
    if (stat.size > 200000) continue // skip very large files
    const content = fs.readFileSync(file, 'utf8')
    const matches = findRegexLiterals(content)
    if (matches.length) {
      console.log('File:', file)
      for (const m of matches) {
        const snippet = content
          .substr(Math.max(0, m.index - 40), Math.min(200, content.length - m.index + 40))
          .replace(/\n/g, '\\n')
        console.log('  =>', m.match)
        console.log('     snippet:', snippet)
        total++
      }
    }
  } catch (e) {
    console.error('error reading', file, e && e.message)
  }
}
console.log('Total regex-like literals found:', total)
