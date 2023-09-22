import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import image from '@rollup/plugin-image'
import autoprefixer from 'autoprefixer'
// import postcss from 'rollup-plugin-postcss'
import postcss from 'postcss'
import svg from 'rollup-plugin-svg'
import gzipPlugin from 'rollup-plugin-gzip'
import commonjs from '@rollup/plugin-commonjs'
import scss from 'rollup-plugin-scss'

import pkg from './package.json'

const dist = 'dist'
const bundle = 'autoql'

const development = process.env.NODE_ENV === 'dev'

const external = [...Object.keys(pkg.peerDependencies || {}), ...Object.keys(pkg.dependencies || {})]

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
    // postcss({
    //   plugins: [autoprefixer],
    //   extensions: ['.css, .scss'],
    //   extract: 'autoql.esm.css',
    //   minimize: false,
    // }),
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
    commonjs(),
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
