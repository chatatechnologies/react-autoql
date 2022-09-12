import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import svg from 'rollup-plugin-svg'
import autoprefixer from 'autoprefixer'
import postcss from 'rollup-plugin-postcss'
import image from '@rollup/plugin-image'
import analyzer from 'rollup-plugin-analyzer'
import gzipPlugin from 'rollup-plugin-gzip'
import { visualizer } from 'rollup-plugin-visualizer'
import bundleSize from 'rollup-plugin-bundle-size'
import commonjs from 'rollup-plugin-commonjs'

import pkg from './package.json'

const dist = 'dist'
const bundle = 'autoql'

const development = process.env.NODE_ENV === 'dev'
const test = process.env.NODE_ENV === 'test'

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.dependencies || {}),
]

const makeExternalPredicate = (externalArr) => {
  if (externalArr.length === 0) {
    return () => false
  }
  const pattern = new RegExp(`^(${externalArr.join('|')})($|/)`)
  return (id) => pattern.test(id)
}

const common = {
  input: 'src/index.js',
  plugins: [
    resolve({
      mainFields: ['main', 'module'],
    }),
    postcss({
      plugins: [autoprefixer],
      extensions: ['.css, .scss'],
      extract: 'autoql.esm.css',
      minimize: false,
    }),
    image(),
    svg(),
    babel({
      exclude: 'node_modules/**',
      ignore: ['./example'],
    }),
    commonjs(),
    !development && terser(),
    gzipPlugin(),
    test && visualizer(),
    test && bundleSize(),
    test &&
      analyzer({
        limit: 10,
      }),
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