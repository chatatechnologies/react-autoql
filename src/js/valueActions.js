// A column can carry a value_action that adds an "open" button to its table cells:
//   { type: 'link', link_url: 'https://crm.acme.com/accounts/{value}', link_target: '_blank' }
//   { type: 'callback', callback_name: 'openCustomerDrawer' }
// Callbacks are supplied by the host app through the valueActionCallbacks prop, each either a
// function or { onClick, tooltip }.

const VALUE_PLACEHOLDER = '{value}'
const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:']

export const VALUE_ACTION_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" d="M9.5 2.5h4v4"/>' +
  '<path fill="none" stroke="currentColor" d="M13.5 2.5 7.5 8.5"/>' +
  '<path fill="none" stroke="currentColor" d="M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>' +
  '</svg>'

export const getValueAction = (column) => {
  const action = column?.value_action

  if (action?.type === 'link' && typeof action.link_url === 'string' && action.link_url) {
    return { type: 'link', url: action.link_url, target: action.link_target || '_blank' }
  }

  if (action?.type === 'callback' && typeof action.callback_name === 'string' && action.callback_name) {
    return { type: 'callback', name: action.callback_name }
  }

  return undefined
}

export const hasValueActionValue = (value) => value !== null && value !== undefined && value !== ''

// Returns undefined for anything that isn't http(s), so a javascript: URL can't run script in the host page
export const buildValueActionUrl = (urlTemplate, value) => {
  if (!urlTemplate || !hasValueActionValue(value)) {
    return undefined
  }

  const url = urlTemplate.split(VALUE_PLACEHOLDER).join(encodeURIComponent(`${value}`))

  try {
    const { protocol } = new URL(url, window.location.href)
    return ALLOWED_LINK_PROTOCOLS.includes(protocol) ? url : undefined
  } catch (error) {
    return undefined
  }
}

const getCallbackEntry = (action, callbacks) => (action?.type === 'callback' ? callbacks?.[action.name] : undefined)

export const getValueActionTooltip = (action, callbacks) => {
  const customTooltip = getCallbackEntry(action, callbacks)?.tooltip
  if (typeof customTooltip === 'string' && customTooltip) {
    return customTooltip
  }

  return action?.type === 'link' && action.target === '_blank' ? 'Open in new tab' : 'Open'
}

// An unknown callback_name does nothing
export const runValueActionCallback = ({ action, value, row, context, callbacks }) => {
  const entry = getCallbackEntry(action, callbacks)
  const callback = typeof entry === 'function' ? entry : entry?.onClick
  if (typeof callback === 'function') {
    callback(value, row, context)
  }
}
