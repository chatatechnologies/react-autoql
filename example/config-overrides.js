const webpack = require('webpack')

module.exports = function override(config, env) {
  if (config?.module?.rules) {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    })
  }

  return config
}
