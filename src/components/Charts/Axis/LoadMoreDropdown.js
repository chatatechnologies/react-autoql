import React, { Component } from 'react'
import RowNumberSelector from './RowNumberSelector'

import { getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes } from '../helpers.js'

export default class LoadMoreDropdown extends Component {
  constructor(props) {
    super(props)

    this.maxRows = 5000
    this.initialRowNumber = 50
    this.fontSize = 12
    this.axisLabelPaddingTop = 2
    this.axisLabelPaddingLeft = 4

    this.state = {
      currentRowNumber: this.props.dataLength,
    }
  }

  static propTypes = {
    ...axesPropTypes,
  }

  static defaultProps = {
    ...axesDefaultProps,
  }

  componentDidMount = () => {}

  componentDidUpdate = (prevProps, prevState) => {
    // if (prevState.currentRowNumber !== this.state.currentRowNumber) {
    //   this.forceUpdate()
    // }
  }

  getXCenter = () => {
    const xScaleRange = this.props.xScale?.range() || [0, 0]
    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const xCenter = innerWidth / 2

    return xCenter
  }

  renderLoadMoreDropdown = (currentRowNumber, totalRowCount) => {
    const style = {}
    if (this.props.totalRowCount > this.initialRowNumber) {
      style.textDecoration = 'underline'
    }

    return (
      <tspan className='load-more-drop-down-span' id={`load-more-drop-down-span-${this.COMPONENT_ID}`}>
        <tspan id={`visualizing-span-${this.COMPONENT_ID}`}>{`Visualizing `}</tspan>
        <tspan ref={(r) => (this.currentRowNumber = r)} style={style} id={`row-number-span-${this.COMPONENT_ID}`}>
          {currentRowNumber}
        </tspan>
        {` / ${totalRowCount} rows`}
      </tspan>
    )
  }

  render = () => {
    const { currentRowNumber } = this.state
    const { totalRowCount } = this.props

    const componentHeight = getBBoxFromRef(this.LoadMoreDropdownRef)?.height ?? 0

    const currentRowNumberBBox = getBBoxFromRef(this.currentRowNumber)
    const rowNumWidth = currentRowNumberBBox?.width ?? 0
    const rowNumHeight = currentRowNumberBBox?.height ?? 0
    const rowNumberSelectorBorderPosition = {
      x: currentRowNumberBBox?.x - this.axisLabelPaddingLeft,
      y: currentRowNumberBBox?.y - this.axisLabelPaddingTop,
      width: rowNumWidth + 2 * this.axisLabelPaddingLeft,
      height: rowNumHeight + 2 * this.axisLabelPaddingTop,
    }

    return (
      <g ref={(r) => (this.LoadMoreDropdownRef = r)} transform={`translate(0, ${componentHeight})`}>
        <text
          className='x-axis-label'
          data-test='x-axis-label'
          textAnchor='middle'
          y={0}
          x={0}
          style={{
            fontSize: this.fontSize,
            fontFamily: 'inherit',
            fill: 'currentColor',
            fillOpacity: 0.9,
            cursor: 'default',
          }}
        >
          {this.renderLoadMoreDropdown(currentRowNumber, totalRowCount)}
        </text>

        {totalRowCount > this.maxRows ? (
          <svg
            stroke='currentColor'
            fill='#ffcc00'
            strokeWidth='0'
            viewBox='0 0 24 24'
            height='1.4em'
            width='1.4em'
            xmlns='http://www.w3.org/2000/svg'
            x={0}
            y={0}
            data-tip='Row limit (5000) reached. Try applying a filter or narrowing your search to return full results.'
            data-for={this.props.chartTooltipID}
          >
            <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'></path>
          </svg>
        ) : null}
        {currentRowNumberBBox && totalRowCount > this.initialRowNumber ? (
          <RowNumberSelector
            {...this.props}
            column={this.props.xCol}
            positions={['top', 'bottom']}
            align='center'
            childProps={{
              ...rowNumberSelectorBorderPosition,
              //   x: -0.5 * xLabelTextWidth - this.axisLabelPaddingLeft,
              //   y: -0.5 * this.fontSize - this.axisLabelPaddingTop,
              //   width: spanWidth,
              //   height: xBorderHeight,
            }}
            totalRowCount={this.props.totalRowCount}
            currentRowNumber={this.state.currentRowNumber}
            setCurrentRowNumber={(currentRowNumber) => {
              this.setState({ currentRowNumber })
            }}
          />
        ) : null}
      </g>
    )
  }
}
