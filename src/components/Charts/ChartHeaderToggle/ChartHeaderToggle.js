import React from 'react'
import PropTypes from 'prop-types'

import '../AverageLineToggle/AverageLineToggle.scss'

const ChartHeaderToggle = ({ isEnabled, onToggle, disabled, icon, label, tooltipOn, tooltipOff, chartTooltipID }) => {
  const isDisabled = disabled
  const tooltipContent = isEnabled ? tooltipOn : tooltipOff

  return (
    <button
      className={`chart-header-toggle ${isEnabled ? 'enabled' : ''} ${isDisabled ? 'disabled' : ''}`}
      onClick={() => {
        if (!isDisabled) {
          onToggle(!isEnabled)
        }
      }}
      disabled={isDisabled}
      data-tooltip-content={tooltipContent}
      data-tooltip-id={chartTooltipID}
    >
      {icon && <span>{icon}</span>}
      {label && <span>{label}</span>}
    </button>
  )
}

ChartHeaderToggle.propTypes = {
  isEnabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  icon: PropTypes.node,
  label: PropTypes.node,
  tooltipOn: PropTypes.string.isRequired,
  tooltipOff: PropTypes.string.isRequired,
  chartTooltipID: PropTypes.string,
}

ChartHeaderToggle.defaultProps = {
  disabled: false,
  icon: null,
  label: null,
  chartTooltipID: undefined,
}

export default ChartHeaderToggle

