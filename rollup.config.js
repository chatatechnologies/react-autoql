const dist = 'dist'

export default {
  input: 'src/index.js',
  output: [
    {
      file: `${dist}/bundle.cjs.js`,
      format: 'cjs'
    },
    {
      file: `${dist}/bundle.esm.js`,
      // use ES modules to support tree-shaking
      format: 'esm'
    },
    {
      name: 'ChataAI',
      file: `${dist}/bundle.umd.js`,
      format: 'umd'
    }
  ]
}
