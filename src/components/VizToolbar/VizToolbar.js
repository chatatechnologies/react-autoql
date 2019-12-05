import React, { Fragment } from 'react'

import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'

import styles from './VizToolbar.css'

import {
  tableIcon,
  pivotTableIcon,
  columnChartIcon,
  barChartIcon,
  lineChartIcon,
  pieChartIcon,
  heatmapIcon,
  bubbleChartIcon
  // stackedBarChartIcon
} from '../../svgIcons.js'

class VizToolbar extends React.Component {
  static propTypes = {
    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    displayType: PropTypes.string.isRequired,
    onDisplayTypeChange: PropTypes.func.isRequired,
    disableCharts: PropTypes.bool
  }

  static defaultProps = {
    disableCharts: false
  }

  componentDidUpdate = () => {
    ReactTooltip.rebuild()
  }

  showDisplayTypeButton = displayType => {
    if (this.props.disableCharts && CHART_TYPES.includes(displayType)) {
      return false
    }

    return (
      this.props.supportedDisplayTypes &&
      this.props.supportedDisplayTypes.includes(displayType) &&
      this.props.displayType !== displayType
    )
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      return (
        <button
          onClick={() => this.props.onDisplayTypeChange(displayType)}
          className="chata-toolbar-btn"
          data-tip={name}
          data-for="chata-toolbar-btn-tooltip"
          data-test="viz-toolbar-button"
        >
          {icon}
        </button>
      )
    }
    return null
  }

  render = () => {
    const { displayType, supportedDisplayTypes } = this.props

    if (
      !supportedDisplayTypes ||
      supportedDisplayTypes.length <= 1 ||
      (!supportedDisplayTypes.includes('pivot_table') &&
        this.props.disableCharts)
    ) {
      return null
    }

    if (
      TABLE_TYPES.includes(displayType) ||
      CHART_TYPES.includes(displayType)
    ) {
      return (
        <Fragment>
          <style>{`${styles}`}</style>
          <div
            className={`${this.props.className || ''} viz-toolbar`}
            data-test="viz-toolbar"
          >
            {this.createVisButton('table', 'Table', tableIcon)}
            {this.createVisButton('pivot_table', 'Pivot Table', pivotTableIcon)}
            {this.createVisButton('column', 'Column Chart', columnChartIcon)}
            {this.createVisButton('bar', 'Bar Chart', barChartIcon)}
            {this.createVisButton('line', 'Line Chart', lineChartIcon)}
            {this.createVisButton('pie', 'Pie Chart', pieChartIcon)}
            {this.createVisButton('heatmap', 'Heatmap', heatmapIcon)}
            {this.createVisButton('bubble', 'Bubble Chart', bubbleChartIcon)}
            {this.createVisButton(
              'stacked_bar',
              'Stacked Bar Chart',
              barChartIcon
            )}
            {this.createVisButton(
              'stacked_column',
              'Stacked Column Chart',
              columnChartIcon
            )}
          </div>
        </Fragment>
      )
    }
    return null
  }
}
export default VizToolbar
