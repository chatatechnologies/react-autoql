import React from 'react'
import PropTypes from 'prop-types'

import ChartHeaderToggle from '../ChartHeaderToggle/ChartHeaderToggle'
import './AverageLineToggle.scss'

export const AverageLineToggle = ({ isEnabled, onToggle, disabled, chartTooltipID }) => {
  return (
    <ChartHeaderToggle
      isEnabled={isEnabled}
      onToggle={onToggle}
      disabled={disabled}
      icon='↗'
      label='Average'
      tooltipOn='Hide Average Line'
      tooltipOff='Show Average Line'
      chartTooltipID={chartTooltipID}
    />
  )
}

AverageLineToggle.propTypes = {
  isEnabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  columns: PropTypes.array,
  visibleSeriesIndices: PropTypes.array,
  chartTooltipID: PropTypes.string,
}

AverageLineToggle.defaultProps = {
  disabled: false,
}

export default AverageLineToggle
