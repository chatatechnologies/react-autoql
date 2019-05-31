import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { string } from 'rollup-plugin-string'

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
  // external: makeExternalPredicate(external),
  plugins: [
    resolve(),
    babel({
      exclude: 'node_modules/**'
      // presets: ['@babel/env', '@babel/preset-react']
    }),
    string({
      include: '**/*.css'
    })
    // production && terser()
  ],
  external: ['react', 'react-dom', 'antd', 'rc-drawer', 'prop-types']
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
      // 'rc-drawer': 'Drawer',
      antd: 'Drawer'
    }
  }
]

export default outputs.map(output => ({
  ...common,
  output
}))
