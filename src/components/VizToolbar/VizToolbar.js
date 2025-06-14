import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import { isMobile } from 'react-device-detect'
import { TABLE_TYPES, CHART_TYPES } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Button } from '../Button'
import { Tooltip } from '../Tooltip'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './VizToolbar.scss'

class VizToolbar extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    this.state = {
      displayType: props.responseRef?.state?.displayType,
      supportedDisplayTypes: props.responseRef?._isMounted ? props.responseRef?.getCurrentSupportedDisplayTypes() : [],
    }
  }

  static propTypes = {
    shouldRender: PropTypes.bool,
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
    onDisplayTypeChange: PropTypes.func,
  }

  static defaultProps = {
    shouldRender: true,
    disableCharts: false,
    vertical: false,
    onDisplayTypeChange: undefined,
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  shouldComponentUpdate = (nextProps) => {
    if (!this.props.shouldRender && !nextProps.shouldRender) {
      return false
    }

    return true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  updateDisplayTypes = (supportedDisplayTypes, displayType) => {
    this.setState({ supportedDisplayTypes, displayType })
  }

  showDisplayTypeButton = (displayType) => {
    if (this.props.disableCharts && CHART_TYPES.includes(displayType)) {
      return false
    }

    const supportedDisplayTypes = this.state.supportedDisplayTypes
    return supportedDisplayTypes && supportedDisplayTypes.includes(displayType)
  }

  onDisplayTypeChange = (displayType) => {
    if (this.props.responseRef?._isMounted) {
      this.props.responseRef?.changeDisplayType(displayType)
    }

    if (this.props.onDisplayTypeChange) {
      this.props.onDisplayTypeChange(displayType)
    }
  }

  createVisButton = (displayType, name, icon) => {
    if (this.showDisplayTypeButton(displayType)) {
      const selectedDisplayType = this.state.displayType

      return (
        <Button
          onClick={() => this.onDisplayTypeChange(displayType)}
          className={`react-autoql-toolbar-btn
            ${displayType === selectedDisplayType ? 'react-autoql-toolbar-btn-selected' : ''}`}
          tooltip={name}
          tooltipID={this.props.tooltipID ?? `react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`}
          data-test='viz-toolbar-button'
          disabled={this.props.responseRef?.state?.isLoadingData}
          size='small'
        >
          {icon}
        </Button>
      )
    }

    return null
  }

  render = () => {
    if (!this.props.responseRef?._isMounted) {
      return null
    }

    const displayType = this.state.displayType
    const supportedDisplayTypes = this.state.supportedDisplayTypes

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
            className={`${this.props.className || ''} ${
              isMobile ? 'react-autoql-toolbar-mobile' : 'react-autoql-toolbar'
            } viz-toolbar ${this.props.vertical ? 'vertical' : ''}`}
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
            {this.createVisButton('histogram', 'Histogram', <Icon type='histogram-chart' />)}
            {this.createVisButton('scatterplot', 'Scatterplot', <Icon type='scatterplot' />)}
          </div>
          {!this.props.tooltipID && (
            <Tooltip tooltipId={`react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`} delayShow={800} />
          )}
        </ErrorBoundary>
      )
    }
    return null
  }
}
export default VizToolbar
