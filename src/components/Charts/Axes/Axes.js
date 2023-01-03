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
    this.xAxis2Key = uuid()
    this.yAxis2Key = uuid()
    this.AXIS_LABEL_SIZE = 30
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

  getLabelTextHeight = (ref) => {
    const fontSize = parseInt(ref?.style?.fontSize, 10)
    return isNaN(fontSize) ? 0 : fontSize
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.currentRowNumber !== this.state.currentRowNumber) {
      this.forceUpdate()
    }
  }

  getXCenter = () => {
    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const xCenter = this.props.deltaX + innerWidth / 2

    return xCenter
  }

  renderLoadMoreDropdown = (currentRowNumber, totalRowNumber) => {
    const style = {}
    if (this.props.totalRowsNumber > this.initialRowNumber) {
      style.textDecoration = 'underline'
    }

    return (
      <tspan className='load-more-drop-down-span' id={`load-more-drop-down-span-${this.COMPONENT_ID}`}>
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
        <tspan data-tip={title} data-for={this.props.chartTooltipID} data-test='axis-label'>
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
    const xCenter = this.getXCenter()
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
            data-for={this.props.chartTooltipID}
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
            currentRowNumber={this.state.currentRowNumber}
            setCurrentRowNumber={(currentRowNumber) => {
              this.setState({ currentRowNumber })
            }}
          />
        ) : null}
      </g>
    )
  }

  renderXAxis = (xAxisTitle, innerHeight) => {
    const xRange = this.props.xScale.range() || [0, 0]
    const yRange = this.props.yScale.range() || [0, 0]

    return (
      <Axis
        {...this.props}
        key={this.xAxisKey}
        orient='Bottom'
        scale={this.props.xScale}
        translateY={this.props.deltaY + innerHeight}
        ticks={this.props.xTicks}
        rotateLabels={this.props.rotateLabels}
        col={this.props.xCol}
        title={xAxisTitle}
        showGridLines={this.props.xGridLines}
      />
    )
  }

  renderYAxis = (yAxisTitle, innerWidth) => {
    return (
      <Axis
        {...this.props}
        key={this.yAxisKey}
        orient='Left'
        scale={this.props.yScale}
        innerWidth={innerWidth}
        ticks={this.props.yTicks}
        col={this.props.yCol}
        title={yAxisTitle}
        showGridLines={this.props.yGridLines}
      />
    )
  }

  renderXAxis2 = (title) => {
    // top
    if (!title) {
      return null
    }
  }

  renderYAxis2 = (title, innerWidth) => {
    if (!this.props.yCol2 || !this.props.yScale2) {
      return null
    }

    return (
      <Axis
        {...this.props}
        ref={(r) => (this.yAxis2Ref = r)}
        key={this.yAxis2Key}
        orient='Right'
        scale={this.props.yScale2}
        translateX={innerWidth}
        ticks={this.props.yTicks2}
        col={this.props.yCol2}
        title={title}
        showGridLines={false}
        hasRightLegend={false}
        hasBottomLegend={false}
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
    const xAxis2Title = this.props.xAxis2Title || this.props.xCol2?.display_name
    const yAxis2Title = this.props.yAxis2Title || this.props.yCol2?.display_name

    const xScaleRange = this.props.xScale?.range() || [0, 0]
    const yScaleRange = this.props.yScale?.range() || [0, 0]

    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const innerHeight = yScaleRange[0] - yScaleRange[1]

    return (
      <g ref={(r) => (this.ref = r)}>
        {/* {this.props.enableAjaxTableData &&
          this.renderXAxisLoadMoreDropdown(this.state.currentRowNumber, this.props.totalRowsNumber)} */}

        <g className='react-autoql-axes' data-test='react-autoql-axes'>
          {this.renderXAxis(xAxisTitle, innerHeight)}
          {this.renderYAxis(yAxisTitle, innerWidth)}
          {/* {this.renderXAxis2(xAxis2Title)} */}
          {this.renderYAxis2(yAxis2Title, innerWidth)}
        </g>
      </g>
    )
  }
}
