import { DisplayTypes } from 'autoql-fe-utils'

// Features that are built but not released yet. Set a toggle to true to turn the feature on.
// An object (not separate constants) so tests can switch a feature on.
export const featureToggles = {
  treemap: false,
  splitBy: false,
  rose: true,
}

export const isDisplayTypeEnabled = (displayType) => {
  if (displayType === DisplayTypes.TREEMAP) {
    return featureToggles.treemap
  }

  if (displayType === DisplayTypes.ROSE) {
    return featureToggles.rose
  }

  return true
}
