import _cloneDeep from 'lodash.clonedeep'

// Sanitize options - if isPivot is false, returns a deep-cloned copy of the original options unchanged.
export function sanitizePivotOptions(options, isPivot = false) {
  const opts = _cloneDeep(options || {})

  if (!isPivot) return opts

  // Remove ajax handlers for pivot tables as data is local
  if (opts.ajaxRequestFunc) delete opts.ajaxRequestFunc
  ;[
    'ajaxURL',
    'ajaxURLGenerator',
    'ajaxConfig',
    'ajaxParams',
    'ajaxResponse',
    'ajaxError',
    'progressiveLoad',
    'pagination',
    'paginationSize',
    'paginationMode',
    'paginationSizeSelector',
  ].forEach((k) => {
    if (k in opts) delete opts[k]
  })

  // Use local modes for pivot to avoid data reload/virtualization issues.
  if (typeof LOCAL_OR_REMOTE !== 'undefined' && LOCAL_OR_REMOTE && 'LOCAL' in LOCAL_OR_REMOTE) {
    opts.sortMode = LOCAL_OR_REMOTE.LOCAL
    opts.filterMode = LOCAL_OR_REMOTE.LOCAL
    opts.paginationMode = LOCAL_OR_REMOTE.LOCAL
  }

  return opts
}
