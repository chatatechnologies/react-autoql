import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'
import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './VizToolbar.scss'

class VizToolbar extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    onDisplayTypeChange: PropTypes.func,
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
  }

  static defaultProps = {
    onDisplayTypeChange: () => {},
    disableCharts: false,
    vertical: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    this.rebuildTooltips()
  }

  componentDidUpdate = () => {
    this.rebuildTooltips()
  }

  componentWillUnmount = () => {
    this._isMounted = false
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

    const supportedDisplayTypes = this.getCurrentSupportedDisplayTypes()
    return supportedDisplayTypes && supportedDisplayTypes.includes(displayType)
  }

  onDisplayTypeChange = (displayType) => {
    this.props.onDisplayTypeChange(displayType)
    this.props.responseRef?.changeDisplayType(displayType)
  }

  getCurrentDisplayType = () => {
    return this.props.responseRef?.state?.displayType
  }

  getCurrentSupportedDisplayTypes = () => {
    return this.props.responseRef?.state?.supportedDisplayTypes
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      const selectedDisplayType = this.getCurrentDisplayType()

      return (
        <button
          onClick={() => this.onDisplayTypeChange(displayType)}
          className={`react-autoql-toolbar-btn ${
            displayType === selectedDisplayType ? 'selected' : ''
          }`}
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
    const displayType = this.getCurrentDisplayType()
    const supportedDisplayTypes = this.getCurrentSupportedDisplayTypes()

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
            className={`${
              this.props.className || ''
            } react-autoql-toolbar viz-toolbar ${
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
