// Reads the propTypes and defaultProps of each documented component with react-docgen and writes
// one JSON file per component to src/data/props/, which <PropsTable> renders.
//
// Props whose /** */ comment contains @internal are kept in the JSON with `internal: true` and are
// hidden by <PropsTable>. react-docgen only reads /** */ comments, never // comments.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, builtinResolvers, builtinImporters } from 'react-docgen'
import { DOCUMENTED_COMPONENTS } from './components.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const outDir = path.resolve(here, '../src/data/props')

function formatType(type) {
  if (!type) return { text: 'unknown' }
  switch (type.name) {
    case 'union':
      return { text: type.value.map((t) => formatType(t).text).join(' | ') }
    case 'enum':
      return { text: Array.isArray(type.value) ? type.value.map((v) => v.value).join(' | ') : 'enum' }
    case 'arrayOf':
      return { text: `${formatType(type.value).text}[]` }
    case 'objectOf':
      return { text: `{ [key: string]: ${formatType(type.value).text} }` }
    case 'instanceOf':
      return { text: type.value }
    case 'custom':
      return { text: type.raw || 'custom' }
    case 'shape':
    case 'exact': {
      if (typeof type.value !== 'object') return { text: 'object' }
      // Fields tagged /** @internal */ in the shape (e.g. in src/props/types.js) are left out.
      const fields = Object.entries(type.value)
        .filter(([, value]) => !/(^|\s)@internal\b/.test(value.description || ''))
        .map(([key, value]) => ({
          name: key,
          type: formatType(value).text,
          required: !!value.required,
        }))
      return { text: 'object', fields }
    }
    case 'func':
      return { text: 'function' }
    case 'bool':
      return { text: 'boolean' }
    default:
      return { text: type.name }
  }
}

// Defaults that point at autoql-fe-utils' shared objects (src/Constants/defaults.ts), which this
// script can't evaluate. authenticationDefault has every field undefined, so it counts as no default.
const SHARED_DEFAULTS = {
  authenticationDefault: { default: null },
  autoQLConfigDefault: { default: null, defaultNote: 'Each field has its own default' },
  dataFormattingDefault: { default: null, defaultNote: 'Each field has its own default' },
}

function formatDefault(defaultValue) {
  if (!defaultValue || defaultValue.value === 'undefined') return { default: null }
  const value = defaultValue.value.trim()
  if (SHARED_DEFAULTS[value]) return SHARED_DEFAULTS[value]
  return { default: value.replace(/\s*\n\s*/g, ' ').replace(/,\s*}/g, ' }') }
}

function documentComponent({ name, file }) {
  const filename = path.join(repoRoot, file)
  const source = fs.readFileSync(filename, 'utf8')
  const docs = parse(source, {
    filename,
    resolver: new builtinResolvers.FindExportedDefinitionsResolver(),
    importer: builtinImporters.fsImporter,
    babelOptions: { babelrc: false, configFile: false },
  })
  // A file can export several definitions (e.g. the themed default export and the bare class).
  // Keep the one that declares the most props.
  const doc = docs.reduce(
    (best, d) => (Object.keys(d.props || {}).length > Object.keys(best.props || {}).length ? d : best),
    docs[0] || {},
  )

  const props = Object.entries(doc.props || {})
    .map(([propName, p]) => {
      const description = (p.description || '').trim()
      const internal = /(^|\s)@internal\b/.test(description)
      return {
        name: propName,
        ...formatType(p.type),
        required: !!p.required,
        ...formatDefault(p.defaultValue),
        description: description.replace(/(^|\s)@internal\b:?\s*/, '$1').trim(),
        internal,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return { component: name, file, props }
}

fs.mkdirSync(outDir, { recursive: true })
let failed = false
for (const component of DOCUMENTED_COMPONENTS) {
  try {
    const result = documentComponent(component)
    fs.writeFileSync(path.join(outDir, `${component.name}.json`), JSON.stringify(result, null, 2) + '\n')
    const shown = result.props.filter((p) => !p.internal)
    const undocumented = shown.filter((p) => !p.description).length
    console.log(
      `${component.name.padEnd(18)} ${String(shown.length).padStart(3)} public, ${String(
        result.props.length - shown.length,
      ).padStart(3)} internal, ${undocumented} without a description`,
    )
  } catch (error) {
    failed = true
    console.error(`${component.name}: ${error.message}`)
  }
}
if (failed) process.exit(1)
