module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // use rollup to transpile, not babel
        modules: false,
        targets: {
          // https://browserl.ist/?q=%3E+0.25%25%2C+ie+11%2C+not+op_mini+all%2C+not+dead
          browsers: '> 0.25%, ie 11, not op_mini all',
          node: 8,
        },
      },
    ],
    '@babel/preset-react',
  ],
  plugins: [
    '@babel/plugin-transform-class-properties',
    '@babel/plugin-transform-object-rest-spread',
    '@babel/plugin-syntax-object-rest-spread',
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator',
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: false,
        corejs: false,
        helpers: false,
        regenerator: true,
        version: '7.0.0-beta.0',
      },
    ],
  ],
  // required for transpilation to work with jest
  env: {
    test: {
      presets: ['@babel/preset-env', '@babel/preset-react'],
      plugins: [
        '@babel/plugin-transform-modules-commonjs',
        '@babel/plugin-transform-class-properties',
        '@babel/plugin-transform-object-rest-spread',
        '@babel/plugin-syntax-object-rest-spread',
        '@babel/plugin-transform-optional-chaining',
        '@babel/plugin-transform-nullish-coalescing-operator',
      ],
    },
  },
}
