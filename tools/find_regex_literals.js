const fs = require('fs')
const path = require('path')

function walk(dir, filelist = []) {
  fs.readdirSync(dir).forEach((file) => {
    const fp = path.join(dir, file)
    const stat = fs.statSync(fp)
    if (stat.isDirectory()) {
      walk(fp, filelist)
    } else if (fp.endsWith('.ts') || fp.endsWith('.tsx') || fp.endsWith('.js') || fp.endsWith('.jsx')) {
      filelist.push(fp)
    }
  })
  return filelist
}

function findRegexLiterals(content) {
  const regex = /(^|[^/])\/((?:\\.|[^\\/\r\n])+?)\/([gimsuy]*)/gm
  const matches = []
  let m
  while ((m = regex.exec(content)) !== null) {
    matches.push({ match: m[0].slice(m[1].length), index: m.index + m[1].length })
  }
  return matches
}

const base = path.resolve(process.cwd(), '..', 'autoql-fe-utils', 'src')
const files = walk(base)
let total = 0
files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8')
  const matches = findRegexLiterals(content)
  if (matches.length) {
    console.log('File:', file)
    matches.forEach((m) => {
      const snippet = content
        .substr(Math.max(0, m.index - 40), Math.min(200, content.length - m.index + 40))
        .replace(/\n/g, '\\n')
      console.log('  =>', m.match)
      console.log('     snippet:', snippet)
      total++
    })
  }
})
console.log('Total regex-like literals found:', total)
