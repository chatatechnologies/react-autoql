import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import svg from 'rollup-plugin-svg'
import autoprefixer from 'autoprefixer'
import postcss from 'rollup-plugin-postcss'

import pkg from './package.json'

const dist = 'dist'
const bundle = 'autoql'

const production = process.env.NODE_ENV !== 'dev'

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.dependencies || {}),
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
      extensions: ['.css, .scss'],
      extract: true,
      minimize: false,
    }),
    svg(),
    babel({
      plugins: ['external-helpers'],
      exclude: 'node_modules/**',
    }),
    production && terser(),
  ],
  external: makeExternalPredicate(external),
}

const outputs = [
  // {
  //   file: `${dist}/${bundle}.cjs.js`,
  //   format: 'cjs',
  //   plugins: [
  //     resolve(),
  //     // postcss({
  //     //   plugins: [autoprefixer],
  //     //   extensions: ['.css']
  //     // }),
  //     css({ output: 'bundle.cjs.css' }),
  //     svg(),
  //     babel({
  //       plugins: ['external-helpers'],
  //       exclude: 'node_modules/**'
  //     })
  //   ]
  // },
  {
    file: `${dist}/${bundle}.esm.js`,
    format: 'esm', // use ES modules to support tree-shaking
  },
  // {
  //   name: 'ChataAI',
  //   file: `${dist}/${bundle}.umd.js`,
  //   format: 'umd',
  //   globals: {
  //     react: 'React',
  //     'prop-types': 'PropTypes',
  //     'rc-drawer': 'Drawer',
  //     uuid: 'uuid',
  //     'react-custom-scrollbars': 'Scrollbars',
  //     axios: 'axios',
  //     'react-autosuggest': 'Autosuggest',
  //     'react-speech-recognition': 'SpeechRecognition',
  //     'react-tabulator': 'reactTabulator',
  //     'rc-drawer/assets/index.css': 'rcStyles',
  //     'react-tooltip': 'ReactTooltip',
  //     'react-icons/md': 'md',
  //     'react-icons/io': 'io',
  //     'react-icons/fa': 'fa',
  //     numbro: 'Numbro',
  //     dayjs: 'dayjs',
  //     'd3-selection': 'd3Selection',
  //     'd3-axis': 'd3Axis',
  //     'd3-scale': 'd3Scale',
  //     'd3-array': 'd3Array',
  //     'd3-shape': 'd3Shape',
  //     'd3-collection': 'd3Collection',
  //     'd3-interpolate': 'd3Interpolate',
  //     'd3-svg-legend': 'd3SVGLegend',
  //     'react-grid-layout': 'RGL',
  //     'react-grid-layout/css/styles.css': 'gridLayoutStyles',
  //     'react-tiny-popover': 'Popver',
  //     'disable-scroll': 'disableScroll',
  //     'lodash.get': '_get',
  //     'lodash.isequal': '_isEqual',
  //     'lodash.clonedeep': '_cloneDeep'
  //   }
  // }
]

export default outputs.map(output => ({
  ...common,
  output,
}))
