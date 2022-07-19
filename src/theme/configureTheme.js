import { LIGHT_THEME, DARK_THEME } from './Themes'

const defaultThemeConfig = {
  theme: 'light',
  chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
  accentColor: '#26A7E9',
  fontFamily: 'sans-serif',
  dashboardTitleColor: undefined,
  dashboardBackground: undefined,
}

const getThemeConfig = (customThemeConfig = {}) => {
  return {
    ...defaultThemeConfig,
    ...customThemeConfig,
  }
}

const getYIQFromHex = (hex) => {
  //Learned from https://gomakethings.com/dynamically-changing-the-text-color-based-on-background-color-contrast-with-vanilla-js/
  let color = hex
  if (color.slice(0, 1) === '#') {
    color = color.slice(1)
  }

  // If a three-character hexcode, make six-character
  if (color.length === 3) {
    color = color
      .split('')
      .map((color) => color + color)
      .join('')
  }

  // Convert to RGB value
  const r = parseInt(color.substr(0, 2), 16)
  const g = parseInt(color.substr(2, 2), 16)
  const b = parseInt(color.substr(4, 2), 16)

  // Get YIQ ratio
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq
}

export const getThemeValue = (property) => {
  return document.documentElement.style.getPropertyValue(
    `--react-autoql-${property}`
  )
}

export const getThemeType = () => {
  try {
    const primaryTextColor = getThemeValue('text-color-primary')
    const textColorYIQ = getYIQFromHex(primaryTextColor)
    const themeType = textColorYIQ >= 140 ? 'light' : 'dark'
    return themeType
  } catch (error) {
    console.error(error)
    return 'light'
  }
}

export const getChartColorVars = () => {
  try {
    const chartColors = []
    const maxLoops = 100
    let counter = 0
    while (counter < maxLoops) {
      try {
        const chartColor = getThemeValue(`chart-color-${counter}`)
        if (chartColor) {
          chartColors.push(chartColor)
        } else {
          return chartColors
        }
      } catch (error) {}
      counter += 1
    }
    return chartColors
  } catch (error) {
    console.error(
      'Could not get chart color css vars. See below for error details'
    )
    console.error(error)
    return []
  }
}

const setAccentColorVars = (accentColor, themeStyles) => {
  const accentColorYIQ = getYIQFromHex(accentColor)
  themeStyles['accent-text-color'] = accentColorYIQ >= 140 ? 'black' : 'white'
}

const setChartColors = (chartColors, themeStyles) => {
  if (!Array.isArray(chartColors)) {
    console.error('configureTheme chartColors option must be an array')
    return
  } else if (!chartColors.length) {
    console.error(
      'configureTheme chartColors option must not be empty. If you meant to use the default colors, do not supply a chart colors array'
    )
    return
  }

  chartColors.forEach((color, i) => {
    themeStyles[`chart-color-${i}`] = color
  })
}

export const configureTheme = (customThemeConfig = {}) => {
  const {
    theme,
    fontFamily,
    chartColors,
    accentColor,
    color,
    dashboardTitleColor,
    dashboardBackground,
  } = getThemeConfig(customThemeConfig)

  const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME

  if (color) {
    themeStyles['accent-text-color'] = color
  } else {
    setAccentColorVars(accentColor, themeStyles)
  }

  if (chartColors) {
    setChartColors(chartColors, themeStyles)
  }

  if (accentColor) {
    themeStyles['accent-color'] = accentColor
  }

  if (fontFamily) {
    themeStyles['font-family'] = fontFamily
  }

  themeStyles['dashboard-background-color'] =
    dashboardBackground || themeStyles['background-color-secondary']

  themeStyles['dashboard-title-color'] =
    dashboardTitleColor || themeStyles['accent-color']

  // Apply values to css variables with --react-autoql prefix
  for (let property in themeStyles) {
    document.documentElement.style.setProperty(
      `--react-autoql-${property}`,
      themeStyles[property]
    )
  }
}
