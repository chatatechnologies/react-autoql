import React from 'react'
import PropTypes from 'prop-types'

import './AverageLineToggle.scss'

export class AverageLineToggle extends React.Component {
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
        'Cannot show average line when chart has series with different data types (e.g., currency and quantity)'
    } else {
      tooltipContent = isEnabled ? 'Hide Average Line' : 'Show Average Line'
    }

    // Button dimensions
    const buttonWidth = 60
    const buttonHeight = 26
    const borderRadius = 4

    return (
      <g
        className={`average-line-toggle ${isEnabled ? 'enabled' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={isDisabled ? undefined : this.handleClick}
        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: 0 }}
        data-tooltip-content={tooltipContent}
        data-tooltip-id={chartTooltipID}
      >
        {/* Button background */}
        <rect
          x={0}
          y={0}
          width={buttonWidth}
          height={buttonHeight}
          rx={borderRadius}
          ry={borderRadius}
          className='button-background'
        />
        <text x={8} y={16} fontSize='12' className='button-icon'>
          ↗
        </text>
        <text x={24} y={16} fontSize='11' className='button-label'>
          Avg
        </text>
      </g>
    )
  }
}

export default AverageLineToggle
