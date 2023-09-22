import React, { Component } from 'react'
import { select } from 'd3-selection'
import { getBBoxFromRef } from 'autoql-fe-utils'

import RowNumberSelector from './RowNumberSelector'

import { axesDefaultProps, axesPropTypes } from '../chartPropHelpers.js'

export default class LoadMoreDropdown extends Component {
  constructor(props) {
    super(props)

    this.maxRows = 5000
    this.BUTTON_PADDING_TOP = 2
    this.BUTTON_PADDING_LEFT = 4
    this.VISUALIZING_TEXT = 'Visualizing '

    this.state = {
      currentRowNumber: props.currentRowCount,
    }
  }

  static propTypes = {
    ...axesPropTypes,
  }

  static defaultProps = {
    ...axesDefaultProps,
  }

  componentDidMount = () => {
    this.applyStyles()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.currentRowNumber !== prevState.currentRowNumber) {
      this.forceUpdate()
    }

    this.applyStyles()
  }

  applyRowNumberSelectorStyles = () => {
    const currentRowNumberBBox = getBBoxFromRef(this.currentRowNumber)
    const rowNumWidth = currentRowNumberBBox?.width ?? 0
    const rowNumHeight = currentRowNumberBBox?.height ?? 0

    select(this.rowNumberSelector?.popoverRef)
      .attr('x', currentRowNumberBBox?.x - this.BUTTON_PADDING_LEFT)
      .attr('y', currentRowNumberBBox?.y - this.BUTTON_PADDING_TOP)
      .attr('width', rowNumWidth + 2 * this.BUTTON_PADDING_LEFT)
      .attr('height', rowNumHeight + 2 * this.BUTTON_PADDING_TOP)
  }

  applyWarningIconStyles = () => {
    const allTextBBox = getBBoxFromRef(this.ref)
    const allTextWidth = allTextBBox?.width ?? 0
    const warningIconX = allTextBBox?.x + allTextWidth + 5
    const warningIconY = -5

    select(this.warningIcon).attr('x', warningIconX).attr('y', warningIconY)
  }

  applyStyles = () => {
    this.applyWarningIconStyles()
    this.applyRowNumberSelectorStyles()
  }

  initializeWidth = () => {
    select(this.visualizingSpan).text(this.VISUALIZING_TEXT)
    select(this.ref).attr('textLength', null)
    this.applyStyles()
  }

  adjustWidth = (availableWidth) => {
    select(this.visualizingSpan).text('')

    this.applyStyles()

    const newWidth = getBBoxFromRef(this.LoadMoreDropdownRef)?.width

    if (newWidth > availableWidth) {
      const warningIconWidth = this.warningIcon ? 25 : 0
      const newTextLength = availableWidth - warningIconWidth
      select(this.ref).attr('textLength', newTextLength)
      this.applyStyles()
    }
  }

  renderRowCountText = () => {
    const style = {}
    if (this.props.isRowCountSelectable) {
      style.textDecoration = 'underline'
    }

    return (
      <text
        ref={(r) => (this.ref = r)}
        className='x-axis-label'
        data-test='x-axis-label'
        dominantBaseline='hanging'
        textAnchor='middle'
        style={this.props.style}
        textLength={10}
        lengthAdjust='spacingAndGlyphs'
      >
        <tspan
          ref={(r) => (this.allText = r)}
          className='load-more-drop-down-span'
          id={`load-more-drop-down-span-${this.COMPONENT_ID}`}
        >
          <tspan
            ref={(r) => (this.visualizingSpan = r)}
            id={`visualizing-span-${this.COMPONENT_ID}`}
            className='visualizing-span'
          >
            {this.VISUALIZING_TEXT}
          </tspan>
          <tspan ref={(r) => (this.currentRowNumber = r)} style={style} id={`row-number-span-${this.COMPONENT_ID}`}>
            {this.state.currentRowNumber}
          </tspan>
          <tspan>{` / ${this.props.totalRowCount} rows`}</tspan>
        </tspan>
      </text>
    )
  }

  renderRowDropdownButton = () => {
    if (!this.props.isRowCountSelectable) {
      return null
    }

    return (
      <RowNumberSelector
        {...this.props}
        ref={(r) => (this.rowNumberSelector = r)}
        column={this.props.xCol}
        positions={['top', 'bottom', 'right', 'left']}
        align='center'
        totalRowCount={this.props.totalRowCount}
        currentRowNumber={this.state.currentRowNumber}
        setCurrentRowNumber={(currentRowNumber) => {
          this.setState({ currentRowNumber })
        }}
      />
    )
  }

  renderDrilldownInfoIcon = () => {
    return (
      <svg
        ref={(r) => (this.warningIcon = r)}
        className='drilldown-info-icon'
        viewBox='0 0 24 24'
        height='1.4em'
        width='1.4em'
        xmlns='http://www.w3.org/2000/svg'
        data-tooltip-content='This visualization is showing a subset of the data. <em>Drilldowns</em> will be executed on the <strong>full</strong> dataset.'
        data-tooltip-id={this.props.chartTooltipID}
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'></path>
      </svg>
    )
  }

  renderMaxRowWarningIcon = () => {
    return (
      <svg
        ref={(r) => (this.warningIcon = r)}
        className='max-rows-info-icon'
        viewBox='0 0 24 24'
        height='1.4em'
        width='1.4em'
        xmlns='http://www.w3.org/2000/svg'
        data-tooltip-content='Row limit (5000) reached. Try applying a filter or narrowing your search to return full results.'
        data-tooltip-id={this.props.chartTooltipID}
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'></path>
      </svg>
    )
  }

  renderInfoIcon = () => {
    if (this.props.totalRowCount > this.maxRows) {
      return this.renderMaxRowWarningIcon()
    }

    if (this.state.currentRowNumber < this.props.totalRowCount) {
      return this.renderDrilldownInfoIcon()
    }

    return null
  }

  render = () => {
    return (
      <g ref={(r) => (this.LoadMoreDropdownRef = r)}>
        {this.renderRowCountText()}
        {this.renderRowDropdownButton()}
        {this.renderInfoIcon()}
      </g>
    )
  }
}
