import { LIGHT_THEME, DARK_THEME } from './Themes'

const defaultThemeConfig = {
  theme: 'light',
  chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
  accentColor: '#26A7E9',
  fontFamily: 'sans-serif',
  textColor: undefined,
  accentTextColor: undefined,
  backgroundColorPrimary: undefined,
  backgroundColorSecondary: undefined,
}

const getThemeConfig = (customThemeConfig = {}) => {
  return {
    ...defaultThemeConfig,
    ...customThemeConfig,
  }
}

const getYIQFromHex = (hex) => {
  // Learned from https://gomakethings.com/dynamically-changing-the-text-color-based-on-background-color-contrast-with-vanilla-js/
  let color = hex
  if (color.slice(0, 1) === '#') {
    color = color.slice(1)
  }

  // If a three-character hexcode, make six-character
  if (color.length === 3) {
    color = color
      .split('')
      .map((col) => col + col)
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

const lightenDarkenColor = (col, amt) => {
  let usePound = false
  if (col[0] == '#') {
    col = col.slice(1)
    usePound = true
  }

  const num = parseInt(col, 16)

  let r = (num >> 16) + amt
  if (r > 255) r = 255
  else if (r < 0) r = 0

  let b = ((num >> 8) & 0x00ff) + amt
  if (b > 255) b = 255
  else if (b < 0) b = 0

  let g = (num & 0x0000ff) + amt
  if (g > 255) g = 255
  else if (g < 0) g = 0

  const string = '000000' + (g | (b << 8) | (r << 16)).toString(16)
  return (usePound ? '#' : '') + string.substring(string.length - 6)
}

export const getThemeValue = (property) => {
  return document.documentElement.style.getPropertyValue(`--react-autoql-${property}`)
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
    const chartColorsDark = []
    const maxLoops = 100
    let counter = 0
    while (counter < maxLoops) {
      try {
        const chartColor = getThemeValue(`chart-color-${counter}`)
        const chartColorDark = getThemeValue(`chart-color-dark-${counter}`) ?? chartColor
        if (chartColor) {
          chartColors.push(chartColor)
          chartColorsDark.push(chartColorDark)
        } else {
          return { chartColors, chartColorsDark }
        }
      } catch (error) {
        // do nothing
      }
      counter += 1
    }
    return { chartColors, chartColorsDark }
  } catch (error) {
    console.error('Could not get chart color css vars. See below for error details')
    console.error(error)
    return []
  }
}

const setAccentColorVars = (accentColor, themeStyles) => {
  const accentColorYIQ = getYIQFromHex(accentColor)
  themeStyles['text-color-accent'] = accentColorYIQ >= 140 ? 'black' : 'white'
}

const setChartColors = (providedChartColors, themeStyles) => {
  const chartColors = providedChartColors || defaultThemeConfig.chartColors
  if (!Array.isArray(chartColors)) {
    console.error('configureTheme chartColors option must be an array')
    return
  } else if (!chartColors.length) {
    console.error(
      'configureTheme chartColors option must not be empty. If you meant to use the default colors, do not supply a chart colors array',
    )
    return
  }

  chartColors.forEach((color, i) => {
    themeStyles[`chart-color-${i}`] = color

    const darkerColor = lightenDarkenColor(color, -10)
    themeStyles[`chart-color-dark-${i}`] = darkerColor
  })
}

export const configureTheme = (customThemeConfig = {}) => {
  const {
    theme,
    textColor,
    fontFamily,
    chartColors,
    accentColor,
    accentTextColor,
    dashboardTitleColor,
    backgroundColorPrimary,
    backgroundColorSecondary,
  } = getThemeConfig(customThemeConfig)

  const themeStyles = theme === 'light' ? LIGHT_THEME : DARK_THEME

  if (textColor) {
    themeStyles['text-color-primary'] = textColor
  }

  if (accentTextColor) {
    themeStyles['text-color-accent'] = accentTextColor
  } else {
    setAccentColorVars(accentColor, themeStyles)
  }

  if (fontFamily) {
    themeStyles['font-family'] = fontFamily
  }

  if (accentColor) {
    themeStyles['accent-color'] = accentColor
  }

  themeStyles['dashboard-title-color'] = dashboardTitleColor || themeStyles['accent-color']

  if (backgroundColorPrimary) {
    themeStyles['background-color-primary'] = backgroundColorPrimary
  }

  if (backgroundColorSecondary) {
    themeStyles['background-color-secondary'] = backgroundColorSecondary
  }

  setChartColors(chartColors, themeStyles)

  // Apply values to css variables with --react-autoql prefix
  for (const property in themeStyles) {
    document.documentElement.style.setProperty(`--react-autoql-${property}`, themeStyles[property])
  }
}
