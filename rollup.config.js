import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

const dist = 'dist'
const bundle = 'bundle'

const production = !process.env.ROLLUP_WATCH

const common = {
  input: 'src/index.js',
  external: ['react'],
  plugins: [
    resolve(),
    babel({
      exclude: 'node_modules/**'
    }),
    production && terser()
  ]
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
    globals: {
      react: 'React'
    },
    format: 'umd'
  }
]

export default outputs.map(output => ({
  ...common,
  output
}))
