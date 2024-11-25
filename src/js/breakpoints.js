export const BREAKPOINTS = {
  xs: 320,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
}

export const isScreenSize = (size) => {
  return window.innerWidth <= BREAKPOINTS[size]
}

export const isLandscape = () => {
  return window.matchMedia('(orientation: landscape)').matches
}

export const isXs = () => isScreenSize('xs')
export const isSm = () => isScreenSize('sm')
export const isMd = () => isScreenSize('md')
export const isLg = () => isScreenSize('lg')
export const isXl = () => isScreenSize('xl')
export const isXxl = () => isScreenSize('xxl')

export const isMobile = () => isScreenSize('lg')
export const isMobileLandscape = () => isMobile() && isLandscape()
