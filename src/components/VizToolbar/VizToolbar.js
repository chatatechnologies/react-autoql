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
} from '../../svgIcons.js'

class VizToolbar extends React.Component {
  static propTypes = {
    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    displayType: PropTypes.string.isRequired,
    onDisplayTypeChange: PropTypes.func.isRequired
  }

  showDisplayTypeButton = displayType => {
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
        >
          {icon}
        </button>
      )
    }
    return null
  }

  render = () => {
    const { displayType, supportedDisplayTypes } = this.props
    console.log('rendering viz toolbar with these props')
    console.log(displayType)
    console.log(supportedDisplayTypes)

    if (!supportedDisplayTypes || supportedDisplayTypes.length <= 1) {
      return null
    }

    if (
      TABLE_TYPES.includes(displayType) ||
      CHART_TYPES.includes(displayType)
    ) {
      return (
        <Fragment>
          <style>{`${styles}`}</style>
          <div className={`${this.props.className || ''} viz-toolbar`}>
            {this.createVisButton('table', 'Table', tableIcon)}
            {this.createVisButton('pivot_table', 'Pivot Table', pivotTableIcon)}
            {this.createVisButton('column', 'Column Chart', columnChartIcon)}
            {this.createVisButton('bar', 'Bar Chart', barChartIcon)}
            {this.createVisButton('line', 'Line Chart', lineChartIcon)}
            {this.createVisButton('pie', 'Pie Chart', pieChartIcon)}
            {this.createVisButton('heatmap', 'Heatmap', heatmapIcon)}
            {this.createVisButton('bubble', 'Bubble Chart', bubbleChartIcon)}
          </div>
        </Fragment>
      )
    }
    return null
  }
}
export default VizToolbar
