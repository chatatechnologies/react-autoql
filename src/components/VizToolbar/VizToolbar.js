import React from 'react'

import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'

import './VizToolbar.scss'

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

import { Icon } from '../Icon'

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
        <div
          className={`${this.props.className || ''} viz-toolbar`}
          data-test="viz-toolbar"
        >
          {this.createVisButton('table', 'Table', <Icon type="table" />)}
          {this.createVisButton(
            'pivot_table',
            'Pivot Table',
            <Icon type="pivot-table" />
          )}
          {this.createVisButton(
            'column',
            'Column Chart',
            <Icon type="column-chart" />
          )}
          {this.createVisButton('bar', 'Bar Chart', <Icon type="bar-chart" />)}
          {this.createVisButton(
            'line',
            'Line Chart',
            <Icon type="line-chart" />
          )}
          {this.createVisButton('pie', 'Pie Chart', <Icon type="pie-chart" />)}
          {this.createVisButton('heatmap', 'Heatmap', <Icon type="heatmap" />)}
          {this.createVisButton(
            'bubble',
            'Bubble Chart',
            <Icon type="bubble-chart" />
          )}
          {this.createVisButton(
            'stacked_bar',
            'Stacked Bar Chart',
            <Icon type="bar-chart" />
          )}
          {this.createVisButton(
            'stacked_column',
            'Stacked Column Chart',
            <Icon type="column-chart" />
          )}
        </div>
      )
    }
    return null
  }
}
export default VizToolbar
