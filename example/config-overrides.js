const webpack = require('webpack')

module.exports = function override(config, env) {
  if (config?.module?.rules) {
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    })

    // Find the babel-loader rule and update it to handle modern syntax
    const babelRule = config.module.rules.find(rule => 
      rule.test && rule.test.toString().includes('js') && 
      rule.use && Array.isArray(rule.use) &&
      rule.use.some(loader => loader.loader && loader.loader.includes('babel-loader'))
    )

    if (babelRule) {
      const babelLoader = babelRule.use.find(loader => 
        loader.loader && loader.loader.includes('babel-loader')
      )
      
      if (babelLoader && babelLoader.options) {
        // Add plugins for optional chaining and nullish coalescing
        if (!babelLoader.options.plugins) {
          babelLoader.options.plugins = []
        }
        babelLoader.options.plugins.push(
          '@babel/plugin-transform-optional-chaining',
          '@babel/plugin-transform-nullish-coalescing-operator'
        )
      }
    }
  }

  return config
}
