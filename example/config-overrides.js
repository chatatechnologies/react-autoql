const webpack = require('webpack')

module.exports = function override(config, env) {
  if (config?.module?.rules) {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    })

    // Add babel-loader rule for node_modules to handle modern syntax
    config.module.rules.push({
      test: /\.(js|mjs|jsx)$/,
      include: /node_modules\/react-draggable/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          babelrc: false,
          configFile: false,
          compact: false,
          presets: [
            ['@babel/preset-env', { modules: false }],
          ],
          plugins: [
            '@babel/plugin-transform-optional-chaining',
            '@babel/plugin-transform-nullish-coalescing-operator',
          ],
          cacheDirectory: true,
          cacheCompression: false,
        },
      },
    })
  }

  return config
}
