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

import pkg from './package.json'

const dist = 'dist'
const bundle = 'autoql'

const development = process.env.NODE_ENV === 'dev'

// These packages must be bundled into the output rather than left external.
// react-date-range (CJS) requires date-fns v2 subpath imports. If left external,
// consumers with date-fns v3 in their node_modules get a ".default is not a function"
// error because v3 dropped the default export from subpath modules.
const FORCE_BUNDLE = new Set(['react-date-range', 'date-fns'])

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
    resolve({
      mainFields: ['main', 'module'],
    }),
    scss({
      fileName: 'autoql.esm.css',
      processor: () => postcss([autoprefixer()]),
      outputStyle: 'compressed', // minimize
    }),
    image(),
    svg(),
    babel({
      exclude: 'node_modules/**',
      ignore: ['./example'],
      babelHelpers: 'bundled',
    }),
    commonjs({ transformMixedEsModules: true }),
    !development && terser(),
    gzipPlugin(),
  ],
  external: makeExternalPredicate(external),
}

const outputs = []

outputs.push({
  file: `${dist}/${bundle}.esm.js`,
  format: 'esm', // use ES modules to support tree-shaking
})

if (!development) {
  outputs.push({
    file: `${dist}/${bundle}.cjs.js`,
    format: 'cjs',
  })
}

export default outputs.map((output) => ({
  ...common,
  output,
}))
