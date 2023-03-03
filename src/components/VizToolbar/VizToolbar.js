import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'

import { Icon } from '../Icon'
import { rebuildTooltips, Tooltip } from '../Tooltip'

import { TABLE_TYPES, CHART_TYPES } from '../../js/Constants.js'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { deepEqual } from '../../js/Util'

import './VizToolbar.scss'

class VizToolbar extends React.Component {
  COMPONENT_KEY = uuid()

  static propTypes = {
    onDisplayTypeChange: PropTypes.func,
    shouldRender: PropTypes.bool,
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
  }

  static defaultProps = {
    onDisplayTypeChange: () => {},
    shouldRender: true,
    disableCharts: false,
    vertical: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    rebuildTooltips()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!nextProps.shouldRender) {
      return false
    }

    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps) => {
    if (!_isEqual(this.getCurrentSupportedDisplayTypes(this.props), this.getCurrentSupportedDisplayTypes(prevProps))) {
      rebuildTooltips()
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  showDisplayTypeButton = (displayType) => {
    if (this.props.disableCharts && CHART_TYPES.includes(displayType)) {
      return false
    }

    const supportedDisplayTypes = this.getCurrentSupportedDisplayTypes(this.props)
    return supportedDisplayTypes && supportedDisplayTypes.includes(displayType)
  }

  onDisplayTypeChange = (displayType) => {
    if (this.props.responseRef?._isMounted) {
      this.props.responseRef?.changeDisplayType(displayType)
    }
  }

  getCurrentDisplayType = () => {
    return this.props.responseRef?.state?.displayType
  }

  getCurrentSupportedDisplayTypes = (props) => {
    return props.responseRef?.state?.supportedDisplayTypes
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      const selectedDisplayType = this.getCurrentDisplayType()

      return (
        <button
          onClick={() => this.onDisplayTypeChange(displayType)}
          className={`react-autoql-toolbar-btn ${displayType === selectedDisplayType ? 'selected' : ''}`}
          data-tip={name}
          data-for={this.props.tooltipID ?? `react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`}
          data-test='viz-toolbar-button'
        >
          {icon}
        </button>
      )
    }

    return null
  }

  render = () => {
    const displayType = this.getCurrentDisplayType()
    const supportedDisplayTypes = this.getCurrentSupportedDisplayTypes(this.props)

    if (
      !supportedDisplayTypes ||
      supportedDisplayTypes.length <= 1 ||
      (!supportedDisplayTypes.includes('pivot_table') && this.props.disableCharts)
    ) {
      return null
    }

    if (TABLE_TYPES.includes(displayType) || CHART_TYPES.includes(displayType)) {
      return (
        <ErrorBoundary>
          <div
            className={`${this.props.className || ''} react-autoql-toolbar viz-toolbar ${
              this.props.vertical ? 'vertical' : ''
            }`}
            data-test='viz-toolbar'
          >
            {this.createVisButton('table', 'Table', <Icon type='table' />)}
            {this.createVisButton('pivot_table', 'Pivot View', <Icon type='pivot-table' />)}
            {this.createVisButton('column', 'Column Chart', <Icon type='column-chart' />)}
            {this.createVisButton('bar', 'Bar Chart', <Icon type='bar-chart' />)}
            {this.createVisButton('line', 'Line Chart', <Icon type='line-chart' />)}
            {this.createVisButton('pie', 'Pie Chart', <Icon type='pie-chart' />)}
            {this.createVisButton('heatmap', 'Heatmap', <Icon type='heatmap' />)}
            {this.createVisButton('bubble', 'Bubble Chart', <Icon type='bubble-chart' />)}
            {this.createVisButton('stacked_bar', 'Stacked Bar Chart', <Icon type='stacked-bar-chart' />)}
            {this.createVisButton('stacked_column', 'Stacked Column Chart', <Icon type='stacked-column-chart' />)}
            {this.createVisButton('stacked_line', 'Stacked Area Chart', <Icon type='stacked-line-chart' />)}
            {this.createVisButton('column_line', 'Column Line Combo Chart', <Icon type='column-line-chart' />)}
          </div>
          {!this.props.tooltipID && (
            <Tooltip
              className='react-autoql-tooltip'
              id={`react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`}
              effect='solid'
              delayShow={800}
            />
          )}
        </ErrorBoundary>
      )
    }
    return null
  }
}
export default VizToolbar
