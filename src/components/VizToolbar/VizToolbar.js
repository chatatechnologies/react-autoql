import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'

import { Icon } from '../Icon'
import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './VizToolbar.scss'

class VizToolbar extends React.Component {
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
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  showDisplayTypeButton = (displayType) => {
    if (this.props.disableCharts && CHART_TYPES.includes(displayType)) {
      return false
    }

    const selectedDisplayType = this.props.responseRef?.state?.displayType
    const supportedDisplayTypes = this.props.responseRef?.supportedDisplayTypes

    return (
      supportedDisplayTypes && supportedDisplayTypes.includes(displayType)
      // && selectedDisplayType !== displayType
    )
  }

  onDisplayTypeChange = (displayType) => {
    this.props.onDisplayTypeChange(displayType)
    this.props.responseRef?.changeDisplayType(displayType)
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      const selectedDisplayType = this.props.responseRef?.state?.displayType

      return (
        <button
          onClick={() => this.onDisplayTypeChange(displayType)}
          className={`react-autoql-toolbar-btn ${
            displayType === selectedDisplayType ? 'selected' : ''
          }`}
          data-tip={name}
          data-for="react-autoql-toolbar-btn-tooltip"
          data-test="viz-toolbar-button"
        >
          {icon}
        </button>
      )
    }

    return null
  }

  render = () => {
    const displayType = this.props.responseRef?.state?.displayType
    const supportedDisplayTypes = this.props.responseRef?.supportedDisplayTypes

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
              'Pivot Table',
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
        </ErrorBoundary>
      )
    }
    return null
  }
}
export default VizToolbar
