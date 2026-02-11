import _cloneDeep from 'lodash.clonedeep'

// Sanitize options - if isPivot is false, returns a deep-cloned copy of the original options unchanged.
export function sanitizePivotOptions(options, isPivot = false) {
  const opts = _cloneDeep(options || {})

  if (!isPivot) {return opts}

  // Pivot tables now use ajaxRequestFunc with progressive loading like regular tables
  // No need to remove ajax/pagination options - they should work the same way

  return opts
}
