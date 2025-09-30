import React from 'react'
import PropTypes from 'prop-types'

import './RegressionLineToggle.scss'

export class RegressionLineToggle extends React.Component {
  static propTypes = {
    isEnabled: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    columns: PropTypes.array,
    visibleSeriesIndices: PropTypes.array,
    chartTooltipID: PropTypes.string,
  }

  static defaultProps = {
    disabled: false,
  }

  handleClick = () => {
    if (!this.props.disabled) {
      this.props.onToggle(!this.props.isEnabled)
    }
  }

  hasMixedColumnTypes = () => {
    const { columns, visibleSeriesIndices } = this.props

    if (!columns || !visibleSeriesIndices || visibleSeriesIndices.length <= 1) {
      return false
    }

    // Get the types of all visible series columns
    const columnTypes = visibleSeriesIndices.map((index) => columns[index]?.type).filter((type) => type) // Remove undefined types

    // Check if there are multiple different types
    return new Set(columnTypes).size > 1
  }

  render = () => {
    const { isEnabled, disabled, chartTooltipID } = this.props
    const hasMixedTypes = this.hasMixedColumnTypes()
    const isDisabled = disabled || hasMixedTypes

    // Create tooltip content based on state
    let tooltipContent = ''
    if (hasMixedTypes) {
      tooltipContent =
        'Cannot show trend line when chart has series with different data types (e.g., currency and quantity)'
    } else {
      tooltipContent = isEnabled ? 'Hide Trend Line' : 'Show Trend Line'
    }

    return (
      <button
        className={`regression-line-toggle ${isEnabled ? 'enabled' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={this.handleClick}
        disabled={isDisabled}
        data-tooltip-content={tooltipContent}
        data-tooltip-id={chartTooltipID}
      >
        <span>⤴</span>
        <span>TREND</span>
      </button>
    )
  }
}

export default RegressionLineToggle
