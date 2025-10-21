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

  render = () => {
    const { isEnabled, disabled, chartTooltipID } = this.props
    const isDisabled = disabled

    // Create tooltip content based on state
    const tooltipContent = isEnabled ? 'Hide Trend Line' : 'Show Trend Line'

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
