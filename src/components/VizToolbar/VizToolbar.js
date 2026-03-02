import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import { isMobile } from 'react-device-detect'
import { TABLE_TYPES, DisplayTypes, isChartType } from 'autoql-fe-utils'

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
      isPopoverOpen: false,
    }
  }

  static propTypes = {
    shouldRender: PropTypes.bool,
    disableCharts: PropTypes.bool,
    vertical: PropTypes.bool,
    compact: PropTypes.bool,
    onDisplayTypeChange: PropTypes.func,
  }

  static defaultProps = {
    shouldRender: true,
    disableCharts: false,
    vertical: false,
    compact: false,
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
    if (this.props.disableCharts && isChartType(displayType)) {
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

    // Close the compact popover after selecting a viz type
    if (this.props.compact) {
      this.setState({ isPopoverOpen: false })
    }
  }

  getIconForDisplayType = (displayType) => {
    const map = {
      [DisplayTypes.TABLE]: 'table',
      [DisplayTypes.PIVOT_TABLE]: 'pivot-table',
      [DisplayTypes.COLUMN]: 'column-chart',
      [DisplayTypes.BAR]: 'bar-chart',
      [DisplayTypes.LINE]: 'line-chart',
      [DisplayTypes.PIE]: 'pie-chart',
      [DisplayTypes.HEATMAP]: 'heatmap',
      [DisplayTypes.BUBBLE]: 'bubble-chart',
      [DisplayTypes.STACKED_BAR]: 'stacked-bar-chart',
      [DisplayTypes.STACKED_COLUMN]: 'stacked-column-chart',
      [DisplayTypes.STACKED_LINE]: 'stacked-line-chart',
      [DisplayTypes.COLUMN_LINE]: 'column-line-chart',
      [DisplayTypes.HISTOGRAM]: 'histogram-chart',
      [DisplayTypes.SCATTERPLOT]: 'scatterplot',
      [DisplayTypes.NETWORK_GRAPH]: 'network',
    }
    return map[displayType] || 'column-chart'
  }

  renderCompact = () => {
    const { displayType, isPopoverOpen } = this.state

    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-toolbar viz-toolbar viz-toolbar-compact ${isPopoverOpen ? 'open' : ''}`}
          data-test='viz-toolbar'
        >
          {/* Trigger: current icon + caret */}
          <button
            className='viz-toolbar-compact-trigger'
            onClick={() => this.setState((s) => ({ isPopoverOpen: !s.isPopoverOpen }))}
            title='Change Visualization'
          >
            <span className='viz-toolbar-compact-current-icon'>
              <Icon type={this.getIconForDisplayType(displayType)} />
            </span>
            <span className='viz-toolbar-compact-caret'>
              <Icon type='caret-right' />
            </span>
          </button>

          {/* Sliding panel of all chart buttons */}
          <div className='viz-toolbar-compact-panel'>
            <div className='viz-toolbar-compact-panel-inner'>
              {this.createVisButton(DisplayTypes.TABLE, 'Table', <Icon type='table' />)}
              {this.createVisButton(DisplayTypes.PIVOT_TABLE, 'Pivot View', <Icon type='pivot-table' />)}
              {this.createVisButton(DisplayTypes.COLUMN, 'Column Chart', <Icon type='column-chart' />)}
              {this.createVisButton(DisplayTypes.BAR, 'Bar Chart', <Icon type='bar-chart' />)}
              {this.createVisButton(DisplayTypes.LINE, 'Line Chart', <Icon type='line-chart' />)}
              {this.createVisButton(DisplayTypes.PIE, 'Pie Chart', <Icon type='pie-chart' />)}
              {this.createVisButton(DisplayTypes.HEATMAP, 'Heatmap', <Icon type='heatmap' />)}
              {this.createVisButton(DisplayTypes.BUBBLE, 'Bubble Chart', <Icon type='bubble-chart' />)}
              {this.createVisButton(DisplayTypes.STACKED_BAR, 'Stacked Bar Chart', <Icon type='stacked-bar-chart' />)}
              {this.createVisButton(DisplayTypes.STACKED_COLUMN, 'Stacked Column Chart', <Icon type='stacked-column-chart' />)}
              {this.createVisButton(DisplayTypes.STACKED_LINE, 'Stacked Area Chart', <Icon type='stacked-line-chart' />)}
              {this.createVisButton(DisplayTypes.COLUMN_LINE, 'Column Line Combo Chart', <Icon type='column-line-chart' />)}
              {this.createVisButton(DisplayTypes.HISTOGRAM, 'Histogram', <Icon type='histogram-chart' />)}
              {this.createVisButton(DisplayTypes.SCATTERPLOT, 'Scatterplot', <Icon type='scatterplot' />)}
              {this.createVisButton(DisplayTypes.NETWORK_GRAPH, 'Network Graph', <Icon type='network' />)}
            </div>
          </div>
        </div>
        {!this.props.tooltipID && (
          <Tooltip tooltipId={`react-autoql-viz-toolbar-tooltip-${this.COMPONENT_KEY}`} delayShow={800} />
        )}
      </ErrorBoundary>
    )
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

    if (TABLE_TYPES.includes(displayType) || isChartType(displayType)) {
      if (this.props.compact) {
        return this.renderCompact()
      }

      return (
        <ErrorBoundary>
          <div
            className={`${this.props.className || ''} ${
              isMobile ? 'react-autoql-toolbar-mobile' : 'react-autoql-toolbar'
            } viz-toolbar ${this.props.vertical ? 'vertical' : ''}`}
            data-test='viz-toolbar'
          >
            {this.createVisButton(DisplayTypes.TABLE, 'Table', <Icon type='table' />)}
            {this.createVisButton(DisplayTypes.PIVOT_TABLE, 'Pivot View', <Icon type='pivot-table' />)}
            {this.createVisButton(DisplayTypes.COLUMN, 'Column Chart', <Icon type='column-chart' />)}
            {this.createVisButton(DisplayTypes.BAR, 'Bar Chart', <Icon type='bar-chart' />)}
            {this.createVisButton(DisplayTypes.LINE, 'Line Chart', <Icon type='line-chart' />)}
            {this.createVisButton(DisplayTypes.PIE, 'Pie Chart', <Icon type='pie-chart' />)}
            {this.createVisButton(DisplayTypes.HEATMAP, 'Heatmap', <Icon type='heatmap' />)}
            {this.createVisButton(DisplayTypes.BUBBLE, 'Bubble Chart', <Icon type='bubble-chart' />)}
            {this.createVisButton(DisplayTypes.STACKED_BAR, 'Stacked Bar Chart', <Icon type='stacked-bar-chart' />)}
            {this.createVisButton(
              DisplayTypes.STACKED_COLUMN,
              'Stacked Column Chart',
              <Icon type='stacked-column-chart' />,
            )}
            {this.createVisButton(DisplayTypes.STACKED_LINE, 'Stacked Area Chart', <Icon type='stacked-line-chart' />)}
            {this.createVisButton(
              DisplayTypes.COLUMN_LINE,
              'Column Line Combo Chart',
              <Icon type='column-line-chart' />,
            )}
            {this.createVisButton(DisplayTypes.HISTOGRAM, 'Histogram', <Icon type='histogram-chart' />)}
            {this.createVisButton(DisplayTypes.SCATTERPLOT, 'Scatterplot', <Icon type='scatterplot' />)}
            {this.createVisButton(DisplayTypes.NETWORK_GRAPH, 'Network Graph', <Icon type='network' />)}
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
