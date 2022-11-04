import React from 'react'
import _get from 'lodash.get'
import { v4 as uuid } from 'uuid'
import { Axis } from '../Axis'
import AxisSelector from './AxisSelector'
import RowNumberSelector from './RowNumberSelector'
import { getBBoxFromRef } from '../../../js/Util'
import { axesDefaultProps, axesPropTypes } from '../helpers'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)
    this.COMPONENT_ID = uuid()
    this.xAxisKey = uuid()
    this.yAxisKey = uuid()
    this.axisLabelPaddingTop = 5
    this.axisLabelPaddingLeft = 10
    this.maxRows = 5000
    this.initialRowNumber = 50
    this.labelInlineStyles = {
      fontSize: 12,
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.9,
      cursor: 'default',
    }

    this.state = {
      currentRowNumber: this.props.dataLength,
    }
  }

  static propTypes = axesPropTypes
  static defaultProps = axesDefaultProps

  componentDidMount = () => {
    this.props.onLabelChange()
  }

  getLabelTextHeight = (ref) => {
    const fontSize = parseInt(ref?.style?.fontSize, 10)
    return isNaN(fontSize) ? 0 : fontSize
  }
  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.currentRowNumber !== this.state.currentRowNumber) {
      this.forceUpdate()
    }
  }

  renderLoadMoreDropdown = (currentRowNumber, totalRowNumber) => {
    const style = {}
    if (this.props.totalRowsNumber > this.initialRowNumber) {
      style.textDecoration = 'underline'
    }

    return (
      <tspan id={`load-more-drop-down-span-${this.COMPONENT_ID}`}>
        <tspan id={`visualizing-span-${this.COMPONENT_ID}`}>{`Visualizing `}</tspan>
        <tspan style={style} id={`row-number-span-${this.COMPONENT_ID}`}>
          {currentRowNumber}
        </tspan>
        {` / ${totalRowNumber} rows`}
      </tspan>
    )
  }
  renderAxisLabel = (title = '', hasDropdown) => {
    if (title.length > 35) {
      return (
        <tspan data-tip={title} data-for={this.props.tooltipID} data-test='axis-label'>
          {`${title.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan data-test='axis-label'>
        {title}
        {hasDropdown && (
          <tspan
            className='react-autoql-axis-selector-arrow'
            data-test='dropdown-arrow'
            opacity='0' // use css to style so it isnt exported in the png
            fontSize='8px'
          >
            {' '}
            &#9660;
          </tspan>
        )}
      </tspan>
    )
  }

  renderXAxisLoadMoreDropdown = (currentRowNumber, totalRowNumber) => {
    let rowNumberSpan = document.getElementById(`row-number-span-${this.COMPONENT_ID}`)
    let visualizingSpan = document.getElementById(`visualizing-span-${this.COMPONENT_ID}`)
    let loadMoreDropDownSpan = document.getElementById(`load-more-drop-down-span-${this.COMPONENT_ID}`)
    let spanWidth
    let visualizingSpanWidth
    let loadMoreDropDownSpanWidth = 0
    if (rowNumberSpan) {
      spanWidth = rowNumberSpan.getBoundingClientRect().width + 5
    }
    if (visualizingSpan) {
      visualizingSpanWidth = visualizingSpan.getBoundingClientRect().width
    }
    if (loadMoreDropDownSpan) {
      loadMoreDropDownSpanWidth = loadMoreDropDownSpan.getBoundingClientRect().width || 0
    }
    const xCenter =
      (this.props.width - this.props.leftMargin + this.props.rightMargin) / 2 +
      this.props.leftMargin -
      this.props.rightMargin
    const xLabelBbox = getBBoxFromRef(this.LoadMoreDropdownRef)
    const xLabelTextWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelTextHeight = this.getLabelTextHeight(this.LoadMoreDropdownRef)
    const halfTextHeight = xLabelTextHeight / 2
    const xLabelY = this.props.height - (this.props.bottomLegendMargin || 0) - this.axisLabelPaddingTop - halfTextHeight
    const xBorderX = xCenter - xLabelTextWidth / 2 - this.axisLabelPaddingLeft
    const xBorderHeight = xLabelTextHeight + 2 * this.axisLabelPaddingTop
    return (
      <g>
        <text
          ref={(r) => (this.LoadMoreDropdownRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          textAnchor='middle'
          fontWeight='bold'
          y={xLabelY + 4}
          x={xCenter}
          style={this.labelInlineStyles}
        >
          {this.renderLoadMoreDropdown(currentRowNumber, totalRowNumber)}
        </text>

        {totalRowNumber > this.maxRows ? (
          <svg
            stroke='currentColor'
            fill='#ffcc00'
            strokeWidth='0'
            viewBox='0 0 24 24'
            height='1.4em'
            width='1.4em'
            xmlns='http://www.w3.org/2000/svg'
            x={xBorderX + loadMoreDropDownSpanWidth + 15}
            y={xLabelY - 11}
            data-tip='Row limit (5000) reached. Try applying a filter or narrowing your search to return full results.'
            data-for={this.props.tooltipID}
          >
            <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'></path>
          </svg>
        ) : null}
        {totalRowNumber > this.initialRowNumber && typeof visualizingSpanWidth == 'number' ? (
          <RowNumberSelector
            {...this.props}
            column={this.props.xCol}
            positions={['top', 'bottom']}
            align='center'
            childProps={{
              x: xBorderX + visualizingSpanWidth + 7,
              y: xLabelY - 12,
              width: spanWidth,
              height: xBorderHeight,
            }}
            totalRowNumber={this.props.totalRowsNumber}
            setCurrentRowNumber={(currentRowNumber) => {
              this.setState({ currentRowNumber })
            }}
          />
        ) : null}
      </g>
    )
  }
  renderXAxisLabel = (xAxisTitle) => {
    const xCenter =
      (this.props.width - this.props.leftMargin + this.props.rightMargin) / 2 +
      this.props.leftMargin -
      this.props.rightMargin

    const xLabelBbox = getBBoxFromRef(this.xLabelRef)
    const xLabelTextWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelTextHeight = this.getLabelTextHeight(this.xLabelRef)
    const halfTextHeight = xLabelTextHeight / 2

    /* <text> element's y coordinate is anchored on the middle baseline,
    so we need to shift the element up by half of it's height */
    let xLabelY = this.props.height - (this.props.bottomLegendMargin || 0) - this.axisLabelPaddingTop - halfTextHeight
    const xBorderX = xCenter - xLabelTextWidth / 2 - this.axisLabelPaddingLeft
    let xBorderY = xLabelY - halfTextHeight - this.axisLabelPaddingTop
    if (this.props.enableAjaxTableData) {
      // Add extra space for row count display
      xBorderY = xBorderY - 20
      xLabelY = xLabelY - 20
    }
    const xBorderWidth = xLabelTextWidth + 2 * this.axisLabelPaddingLeft
    const xBorderHeight = xLabelTextHeight + 2 * this.axisLabelPaddingTop

    return (
      <g>
        <text
          ref={(r) => (this.xLabelRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          y={xLabelY}
          x={xCenter}
          style={this.labelInlineStyles}
        >
          {this.renderAxisLabel(xAxisTitle, this.props.hasXDropdown)}
        </text>
        {this.props.hasXDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.xCol}
            positions={['top', 'bottom']}
            align='center'
            childProps={{
              x: xBorderX,
              y: xBorderY,
              width: xBorderWidth,
              height: xBorderHeight,
            }}
          />
        )}
      </g>
    )
  }

  renderYAxisLabel = (yAxisTitle) => {
    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.yLabelRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0

    const yLabelTextHeight = this.getLabelTextHeight(this.yLabelRef)

    const yLabelTop = yLabelBoundingRect?.top
    const chartTop = chartBoundingRect?.top

    // X and Y are switched from the rotation (anchored in the middle)
    const yLabelY = yLabelTextHeight
    let yLabelX = -((chartContainerHeight - this.props.bottomMargin) / 2)

    if (yAxisTitle !== this.previousYAxisTitle) {
      // Label changed, reset all svg transforms
      this.originalYLabelHeight = undefined
      this.yLabelTransform = undefined
      this.topDifference = undefined
      this.justChangedYLabel = true
    } else if (this.justChangedYLabel) {
      this.originalYLabelHeight = yLabelHeight
      this.justChangedYLabel = false
    }
    this.previousYAxisTitle = yAxisTitle

    let textLength
    if (this.originalYLabelHeight > chartContainerHeight) {
      // Squeeze text to fit in full height
      this.yLabelTransform = 'rotate(-90)'
      this.topDifference = undefined
      yLabelX = -((chartContainerHeight - this.props.bottomMargin) / 2)
      textLength = Math.floor(chartContainerHeight - this.props.chartContainerPadding)
    } else if (yLabelTop < chartTop) {
      // Y Label can fit, it is just outside of container. Shift it down
      const prevTopDifference = this.topDifference ?? 0
      const topDifference = Math.floor(yLabelTop - chartTop - this.axisLabelPaddingLeft)

      this.topDifference = topDifference + prevTopDifference
      this.yLabelTransform = `rotate(-90) translate(${this.topDifference}, 0)`
    } else if (this.originalYLabelHeight < chartContainerHeight) {
      this.yLabelTransform = undefined
      this.topDifference = undefined
    }

    const yBorderWidth = yLabelHeight + 2 * this.axisLabelPaddingLeft
    const yBorderHeight = yLabelTextHeight + 2 * this.axisLabelPaddingTop
    const yBorderX = yLabelX - yLabelHeight / 2 - this.axisLabelPaddingLeft

    const transform = this.yLabelTransform || 'rotate(-90)'
    return (
      <g>
        <text
          ref={(r) => (this.yLabelRef = r)}
          id={`y-axis-label-${this.yAxisKey}`}
          className='y-axis-label'
          data-test='y-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          transform={transform}
          x={yLabelX}
          y={yLabelY}
          textLength={textLength}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisLabel(yAxisTitle, this.props.hasYDropdown)}
        </text>
        {this.props.hasYDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.yCol}
            positions={['right']}
            align='center'
            childProps={{
              transform,
              width: yBorderWidth,
              height: yBorderHeight,
              x: yBorderX,
              y: 0,
            }}
          />
        )}
      </g>
    )
  }

  renderXAxis = (xAxisTitle) => {
    return (
      <Axis
        {...this.props}
        key={this.xAxisKey}
        orient='Bottom'
        scale={this.props.xScale}
        translate={`translate(0, ${this.props.height - this.props.bottomMargin})`}
        tickSizeInner={-this.props.height + this.props.topMargin + this.props.bottomMargin}
        ticks={this.props.xTicks}
        width={this.props.width - this.props.rightMargin}
        col={this.props.xCol}
        title={xAxisTitle}
        showGridLines={this.props.xGridLines}
      />
    )
  }

  renderYAxis = (yAxisTitle) => {
    return (
      <Axis
        {...this.props}
        key={this.yAxisKey}
        orient='Left'
        scale={this.props.yScale}
        translate={`translate(${this.props.leftMargin}, 0)`}
        tickSizeInner={-this.props.width + this.props.leftMargin + this.props.rightMargin}
        ticks={this.props.yTicks}
        height={this.props.height}
        width={this.props.width - this.props.rightMargin}
        col={this.props.yCol}
        title={yAxisTitle}
        showGridLines={this.props.yGridLines}
      />
    )
  }

  render = () => {
    if (
      !this.props.yScale ||
      !this.props.xScale ||
      !this.props.height ||
      !this.props.width ||
      !this.props.xCol ||
      !this.props.yCol
    ) {
      return null
    }

    const xAxisTitle = this.props.xAxisTitle || this.props.xCol?.display_name
    const yAxisTitle = this.props.yAxisTitle || this.props.yCol?.display_name

    return (
      <g>
        {this.renderYAxisLabel(yAxisTitle)}
        {this.renderXAxisLabel(xAxisTitle)}
        {this.props.enableAjaxTableData &&
          this.renderXAxisLoadMoreDropdown(this.state.currentRowNumber, this.props.totalRowsNumber)}

        <g className='react-autoql-axes' data-test='react-autoql-axes'>
          {this.renderXAxis(xAxisTitle)}
          {this.renderYAxis(yAxisTitle)}
        </g>
      </g>
    )
  }
}
