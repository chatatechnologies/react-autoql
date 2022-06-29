/*
This HOC should wrap every exposed component that could be used in isolation.
It checks if the global css variables have been set by the integrator. If they
haven't been set, it sets them with the default light theme values.

If the theme has already been configured, it does not do anything.
*/

import React, { useEffect } from 'react'

import { configureTheme, getThemeValue } from './configureTheme'

export const withTheme = (Component) => ({ ...props }) => {
  useEffect(() => {
    const hasTheme = !!getThemeValue('accent-color')

    if (!hasTheme) {
      configureTheme()
    }
  }, [])

  return <Component {...props} />
}
