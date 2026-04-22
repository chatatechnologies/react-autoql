import React from 'react'
import PropTypes from 'prop-types'

import ChartHeaderToggle from '../ChartHeaderToggle/ChartHeaderToggle'
import './RegressionLineToggle.scss'

export const RegressionLineToggle = ({ isEnabled, onToggle, disabled, chartTooltipID }) => {
  return (
    <ChartHeaderToggle
      isEnabled={isEnabled}
      onToggle={onToggle}
      disabled={disabled}
      icon='⤴'
      label='Trend'
      tooltipOn='Hide Trend Line'
      tooltipOff='Show Trend Line'
      chartTooltipID={chartTooltipID}
    />
  )
}

RegressionLineToggle.propTypes = {
  isEnabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  columns: PropTypes.array,
  visibleSeriesIndices: PropTypes.array,
  chartTooltipID: PropTypes.string,
}

RegressionLineToggle.defaultProps = {
  disabled: false,
}

export default RegressionLineToggle
