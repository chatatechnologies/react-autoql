import React, { Component } from 'react'
import RowNumberSelector from './RowNumberSelector'

import { getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes } from '../helpers.js'
import { select } from 'd3-selection'

export default class LoadMoreDropdown extends Component {
  constructor(props) {
    super(props)

    this.maxRows = 5000
    this.fontSize = 12
    this.BUTTON_PADDING_TOP = 2
    this.BUTTON_PADDING_LEFT = 4

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

  applyStyles = () => {
    const currentRowNumberBBox = getBBoxFromRef(this.currentRowNumber)
    const rowNumWidth = currentRowNumberBBox?.width ?? 0
    const rowNumHeight = currentRowNumberBBox?.height ?? 0

    select(this.rowNumberSelector?.popoverRef)
      .attr('x', currentRowNumberBBox?.x - this.BUTTON_PADDING_LEFT)
      .attr('y', currentRowNumberBBox?.y - this.BUTTON_PADDING_TOP)
      .attr('width', rowNumWidth + 2 * this.BUTTON_PADDING_LEFT)
      .attr('height', rowNumHeight + 2 * this.BUTTON_PADDING_TOP)

    const allTextBBox = getBBoxFromRef(this.allText)
    const allTextWidth = allTextBBox?.width ?? 0
    const warningIconX = allTextBBox?.x + allTextWidth + 5
    const warningIconY = -5

    select(this.warningIcon).attr('x', warningIconX).attr('y', warningIconY)
  }

  renderRowCountText = () => {
    const style = {}
    if (this.props.totalRowCount > this.props.pageSize) {
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
      >
        <tspan
          ref={(r) => (this.allText = r)}
          className='load-more-drop-down-span'
          id={`load-more-drop-down-span-${this.COMPONENT_ID}`}
        >
          <tspan id={`visualizing-span-${this.COMPONENT_ID}`}>{`Visualizing `}</tspan>
          <tspan ref={(r) => (this.currentRowNumber = r)} style={style} id={`row-number-span-${this.COMPONENT_ID}`}>
            {this.state.currentRowNumber}
          </tspan>
          {` / ${this.props.totalRowCount} rows`}
        </tspan>
      </text>
    )
  }

  renderRowDropdownButton = () => {
    if (!(this.props.totalRowCount > this.props.pageSize)) {
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

  renderMaxRowWarningIcon = () => {
    if (!(this.props.totalRowCount > this.maxRows)) {
      return null
    }

    return (
      <svg
        ref={(r) => (this.warningIcon = r)}
        stroke='currentColor'
        fill='#ffcc00'
        strokeWidth='0'
        viewBox='0 0 24 24'
        height='1.4em'
        width='1.4em'
        xmlns='http://www.w3.org/2000/svg'
        data-tip='Row limit (5000) reached. Try applying a filter or narrowing your search to return full results.'
        data-for={this.props.chartTooltipID}
      >
        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'></path>
      </svg>
    )
  }

  render = () => {
    return (
      <g ref={(r) => (this.LoadMoreDropdownRef = r)}>
        {this.renderRowCountText()}
        {this.renderRowDropdownButton()}
        {this.renderMaxRowWarningIcon()}
      </g>
    )
  }
}
