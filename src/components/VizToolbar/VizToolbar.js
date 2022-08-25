import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault } from '../../props/defaults'
import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'

import './VizToolbar.scss'

import { Icon } from '../Icon'

class VizToolbar extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    themeConfig: themeConfigType,

    supportedDisplayTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
    onDisplayTypeChange: PropTypes.func.isRequired,
    displayType: PropTypes.string,
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,

    displayType: undefined,
    disableCharts: false,
    vertical: false,
  }

  componentDidMount = () => {
    this.rebuildTooltips()
  }

  componentDidUpdate = () => {
    this.rebuildTooltips()
  }

  rebuildTooltips = () => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips()
    } else {
      ReactTooltip.rebuild()
    }
  }

  showDisplayTypeButton = (displayType) => {
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
          className="react-autoql-toolbar-btn"
          data-tip={name}
          data-for={`react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`}
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
        <ErrorBoundary>
          <div
            className={`${this.props.className || ''} viz-toolbar ${
              this.props.vertical ? 'vertical' : ''
            }`}
            data-test="viz-toolbar"
          >
            {this.createVisButton('table', 'Table', <Icon type="table" />)}
            {this.createVisButton(
              'pivot_table',
              'Pivot View',
              <Icon type="pivot-table" />
            )}
            {this.createVisButton(
              'column',
              'Column Chart',
              <Icon type="column-chart" />
            )}
            {this.createVisButton(
              'bar',
              'Bar Chart',
              <Icon type="bar-chart" />
            )}
            {this.createVisButton(
              'line',
              'Line Chart',
              <Icon type="line-chart" />
            )}
            {this.createVisButton(
              'pie',
              'Pie Chart',
              <Icon type="pie-chart" />
            )}
            {this.createVisButton(
              'heatmap',
              'Heatmap',
              <Icon type="heatmap" />
            )}
            {this.createVisButton(
              'bubble',
              'Bubble Chart',
              <Icon type="bubble-chart" />
            )}
            {this.createVisButton(
              'stacked_bar',
              'Stacked Bar Chart',
              <Icon type="stacked-bar-chart" />
            )}
            {this.createVisButton(
              'stacked_column',
              'Stacked Column Chart',
              <Icon type="stacked-column-chart" />
            )}
            {this.createVisButton(
              'stacked_line',
              'Stacked Area Chart',
              <Icon type="stacked-line-chart" />
            )}
          </div>
          <ReactTooltip
            className="react-autoql-tooltip"
            id={`react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`}
            effect="solid"
            delayShow={800}
          />
        </ErrorBoundary>
      )
    }
    return null
  }
}
export default VizToolbar
