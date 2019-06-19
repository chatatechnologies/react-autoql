import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import svg from 'rollup-plugin-svg'
import autoprefixer from 'autoprefixer'
import postcss from 'rollup-plugin-postcss'

import pkg from './package.json'

const dist = 'dist'
const bundle = 'bundle'

const production = !process.env.ROLLUP_WATCH

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.dependencies || {})
]

const makeExternalPredicate = externalArr => {
  if (externalArr.length === 0) {
    return () => false
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`)
  return id => pattern.test(id)
}

const common = {
  input: 'src/index.js',
  plugins: [
    resolve(),
    postcss({
      plugins: [autoprefixer],
      extensions: ['.css']
    }),
    svg(),
    babel({
      exclude: 'node_modules/**'
    }),
    production && terser()
  ],
  preprocessors: [autoprefixer],
  external: makeExternalPredicate(external)
}

const outputs = [
  {
    file: `${dist}/${bundle}.cjs.js`,
    format: 'cjs'
  },
  {
    file: `${dist}/${bundle}.esm.js`,
    // use ES modules to support tree-shaking
    format: 'esm'
  },
  {
    name: 'ChataAI',
    file: `${dist}/${bundle}.umd.js`,
    format: 'umd',
    globals: {
      react: 'React',
      'prop-types': 'PropTypes',
      'rc-drawer': 'Drawer'
    }
  }
]

export default outputs.map(output => ({
  ...common,
  output
}))
