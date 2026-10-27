import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import image from '@rollup/plugin-image'
import autoprefixer from 'autoprefixer'
import postcss from 'postcss'
import svg from 'rollup-plugin-svg'
import gzipPlugin from 'rollup-plugin-gzip'
import commonjs from '@rollup/plugin-commonjs'
import scss from 'rollup-plugin-scss'
import path from 'path'

import pkg from './package.json'

const dist = 'dist'
const bundle = 'autoql'

const development = process.env.NODE_ENV === 'dev'

// These packages must be bundled into the output rather than left external.
// react-date-range (CJS) requires date-fns v2 subpath imports. If left external,
// consumers with date-fns v3 in their node_modules get a ".default is not a function"
// error because v3 dropped the default export from subpath modules.
const FORCE_BUNDLE = new Set(['react-date-range', 'date-fns'])

// The packages of the report builder's text editor, which are bundled and transpiled (below).
const EDITOR_PACKAGES =
  /node_modules\/(@tiptap|prosemirror-[a-z-]+|marked|linkifyjs|orderedmap|rope-sequence|w3c-keyname|crelt)\//

// linkifyjs (the editor's links) has no "exports" map, so `mainFields` would take its CommonJS build, whose named
// exports the commonjs plugin can't see: take its ES module instead, beside the build resolution found, wherever
// linkifyjs is installed (in a node_modules above this folder too, when an app installs this package from a folder).
const linkifyEsm = {
  name: 'linkifyjs-esm',
  async resolveId(source, importer) {
    if (source !== 'linkifyjs') return null
    const resolved = await this.resolve(source, importer, { skipSelf: true })
    return resolved && !resolved.external ? path.join(path.dirname(resolved.id), 'linkify.mjs') : resolved
  },
}

const external = [...Object.keys(pkg.peerDependencies || {}), ...Object.keys(pkg.dependencies || {})]

const makeExternalPredicate = (externalArr) => {
  if (externalArr.length === 0) {
    return () => false
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`)
  return (id) => {
    const root = id.split('/')[0]
    return !FORCE_BUNDLE.has(root) && pattern.test(id)
  }
}

const common = {
  input: 'src/index.js',
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify(development ? 'development' : 'production'),
        'process.env.REGEXP_GUARD_MAX_LEN': JSON.stringify(''),
        'process.env': JSON.stringify({}),
      },
    }),
    linkifyEsm,
    resolve({
      mainFields: ['main', 'module'],
    }),
    scss({
      fileName: 'autoql.esm.css',
      outputStyle: 'compressed',
      processor: () => postcss([autoprefixer()]),
    }),
    image(),
    svg(),
    babel({
      // Every node_modules, not only this folder's: when an app installs this package from a folder (as the example
      // app's Docker build does), its packages can sit in a node_modules above this one. A string pattern is resolved
      // against this folder (even "**/…"), so it's a RegExp. Run over TipTap's files there, this config's React
      // preset fails on their JSX runtime.
      exclude: /node_modules/,
      ignore: ['./example'],
      babelHelpers: 'bundled',
    }),
    // The report builder's text editor (TipTap, ProseMirror and what they bring) is bundled, and transpiled for
    // the same browsers as the rest, so the output stays syntax every consumer's bundler reads. Without the React
    // preset: TipTap's files name a JSX runtime of their own, which it turns away.
    babel({
      include: EDITOR_PACKAGES,
      babelHelpers: 'bundled',
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-env', { modules: false, targets: { browsers: '> 0.25%, ie 11, not op_mini all', node: 8 } }],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          { absoluteRuntime: false, corejs: false, helpers: false, regenerator: true, version: '7.0.0-beta.0' },
        ],
      ],
    }),
    commonjs({ transformMixedEsModules: true }),
    !development && terser(),
    gzipPlugin(),
  ],
  external: makeExternalPredicate(external),
}

const outputs = []

// One file per format, plus the report builder's (ReportBuilder/onDemand.js), which apps fetch only when a report is
// shown: its code goes in a file of its own beside the main one.
outputs.push({
  dir: dist,
  entryFileNames: `${bundle}.esm.js`,
  chunkFileNames: `${bundle}-[name]-[hash].esm.js`,
  format: 'esm', // use ES modules to support tree-shaking
})

if (!development) {
  outputs.push({
    dir: dist,
    entryFileNames: `${bundle}.cjs.js`,
    chunkFileNames: `${bundle}-[name]-[hash].cjs.js`,
    format: 'cjs',
  })
}

export default outputs.map((output) => ({
  ...common,
  output,
}))
