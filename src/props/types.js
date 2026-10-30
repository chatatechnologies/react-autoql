import PropTypes from 'prop-types'

export const authenticationType = PropTypes.shape({
  token: PropTypes.string,
  apiKey: PropTypes.string,
  domain: PropTypes.string,
})

export const dataFormattingType = PropTypes.shape({
  currencyCode: PropTypes.string,
  languageCode: PropTypes.string,
  currencyDecimals: PropTypes.number,
  quantityDecimals: PropTypes.number,
  ratioDecimals: PropTypes.number,
  comparisonDisplay: PropTypes.string,
  monthYearFormat: PropTypes.string,
  dayMonthYearFormat: PropTypes.string,
})

export const autoQLConfigType = PropTypes.shape({
  translation: PropTypes.string,
  test: PropTypes.bool,
  enableAutocomplete: PropTypes.bool,
  enableQueryValidation: PropTypes.bool,
  enableDrilldowns: PropTypes.bool,
  enableQuerySuggestions: PropTypes.bool,
  enableColumnVisibilityManager: PropTypes.bool,
  enableNotifications: PropTypes.bool,
  projectId: PropTypes.string,
  enableProjectSelect: PropTypes.bool,
  enableEditReverseTranslation: PropTypes.bool,
})

export const dataConfigType = PropTypes.shape({
  stringColumnIndices: PropTypes.arrayOf(PropTypes.number),
  numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
  stringColumnIndex: PropTypes.number,
  legendColumnIndex: PropTypes.number,
  numberColumnIndex: PropTypes.number,
})

// Host functions for columns whose value_action is a callback, keyed by callback_name.
// Each is a function, or { onClick, tooltip } to replace the open button's "Open" tooltip.
export const valueActionCallbacksType = PropTypes.objectOf(
  PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ onClick: PropTypes.func, tooltip: PropTypes.string })]),
)
