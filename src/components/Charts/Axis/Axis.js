import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'

import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'

import { formatChartLabel, getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes, mergeBboxes } from '../helpers.js'

import './Axis.scss'

export default class Axis extends Component {
  constructor(props) {
    super(props)

    this.LEGEND_PADDING = 130
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.AXIS_TITLE_PADDING = 20
    this.axisTitlePaddingLeft = 10
    this.axisTitlePaddingTop = 5
    this.swatchElements = []
    this.labelInlineStyles = {
      fontSize: 12,
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.9,
      cursor: 'default',
    }
  }

  static propTypes = {
    ...axesPropTypes,
    scale: PropTypes.func.isRequired,
    col: PropTypes.shape({}).isRequired,
    ticks: PropTypes.array,
    orient: PropTypes.string,
    translateX: PropTypes.number,
    translateY: PropTypes.number,
  }

  static defaultProps = {
    ...axesDefaultProps,
    orient: 'Bottom',
    ticks: undefined,
    translate: undefined,
    translateX: 0,
    translateY: 0,
  }

  componentDidMount = () => {
    this.renderAxis()
  }

  componentDidUpdate = (prevProps) => {
    this.renderAxis()

    if (this.props.rotateLabels !== prevProps.rotateLabels) {
      this.props.onLabelChange()
    }
  }

  styleAxisScalerBorder = () => {
    select(this.axisScaler)
      .attr('class', 'axis-scaler-border')
      .attr('transform', `translate(${this.props.translateX ?? 0}, ${this.props.translateY ?? 0})`)
      .attr('width', _get(this.labelBBox, 'width', 0) + this.BUTTON_PADDING * 2)
      .attr('height', _get(this.labelBBox, 'height', 0) + this.BUTTON_PADDING * 2)
      .attr('x', _get(this.labelBBox, 'x', 0) - this.BUTTON_PADDING)
      .attr('y', _get(this.labelBBox, 'y', 0) - this.BUTTON_PADDING)
      .attr('stroke', 'transparent')
      .attr('stroke-width', '1px')
      .attr('fill', 'transparent')
      .attr('rx', 4)
  }

  renderAxis = () => {
    const self = this
    let axis
    switch (this.props.orient) {
      case 'Bottom': {
        axis = axisBottom()
        break
      }
      case 'Left': {
        axis = axisLeft()
        break
      }
      case 'Right': {
        axis = axisRight()
        break
      }
      case 'Top': {
        axis = axisTop()
        break
      }
      default: {
        break
      }
    }

    axis
      .scale(this.props.scale)
      .tickSizeOuter(0)
      .tickFormat(function (d) {
        return formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting,
        }).formattedLabel
      })

    if (this.props.ticks?.length) {
      axis.tickValues(this.props.ticks)
    }

    if (this.props.orient === 'Left') {
      axis.tickSizeInner(-this.props.innerWidth)
    }

    if (this.axisElement) {
      select(this.axisElement).call(axis)
    }

    if (this.props.orient === 'Bottom' && this.props.rotateLabels) {
      // translate labels slightly to line up with ticks once rotated
      select(this.axisElement)
        .selectAll('.tick text')
        .style('font-family', 'inherit')
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-45)')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
        .attr('fill-opacity', '1')
    } else if (this.props.orient === 'Bottom' && !this.props.rotateLabels) {
      select(this.axisElement)
        .selectAll('.tick text')
        .style('transform', 'rotate(0)')
        .style('text-anchor', 'middle')
        .attr('dy', '10px')
        .attr('dx', '0')
        .attr('fill-opacity', '1')
        .style('font-family', 'inherit')
    }

    select(this.axisElement)
      .selectAll('.axis text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '1')
      .style('font-family', 'inherit')
      .attr('data-for', this.props.chartTooltipID)
      .attr('data-tip', function (d) {
        const { fullWidthLabel, isTruncated } = formatChartLabel({
          d,
          col: self.props.col,
          config: self.props.dataFormatting,
        })
        if (isTruncated) {
          return fullWidthLabel
        }
        return null
      })
      .attr('data-effect', 'float')

    select(this.axisElement).selectAll('.axis path').style('display', 'none')

    select(this.axisElement)
      .selectAll('.axis line')
      .style('stroke-width', '1px')
      .style('stroke', 'currentColor')
      .style('opacity', '0.08')
      .style('shape-rendering', 'crispedges')

    // Make tick line at 0 darker
    select(this.axisElement)
      .selectAll('g.tick')
      .filter((d) => d == 0)
      .select('line')
      .style('opacity', 0.3)

    if (this.axisElement) {
      // svg coordinate system is different from clientRect coordinate system
      // we need to get the deltas first, then we can apply them to the bounding rect
      const axisBBox = this.axisElement.getBBox()
      const axisBoundingRect = this.axisElement.getBoundingClientRect()

      const xDiff = axisBoundingRect.x - axisBBox.x
      const yDiff = axisBoundingRect.y - axisBBox.y

      const labelBboxes = []
      select(this.axisElement)
        .selectAll('g.tick text')
        .each(function () {
          const textBoundingRect = select(this).node().getBoundingClientRect()
          const textBBox = {
            left: textBoundingRect.left - xDiff,
            bottom: textBoundingRect.bottom - yDiff,
            right: textBoundingRect.right - xDiff,
            top: textBoundingRect.top - yDiff,
          }

          labelBboxes.push(textBBox)
        })

      if (labelBboxes) {
        const allLabelsBbox = mergeBboxes(labelBboxes)
        this.labelBBox = allLabelsBbox
      }

      if (this.props.scale?.type === 'LINEAR') {
        this.styleAxisScalerBorder()
      }
    }
  }

  getLabelTextHeight = (ref) => {
    const fontSize = parseInt(ref?.style?.fontSize, 10)
    return isNaN(fontSize) ? 0 : fontSize
  }

  renderAxisTitle = (title = '', hasDropdown) => {
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

  renderXAxisTitle = (xAxisTitle) => {
    const xLabelBbox = getBBoxFromRef(this.xTitleRef)
    const xLabelTextWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelTextHeight = this.getLabelTextHeight(this.xTitleRef)
    const halfTextHeight = xLabelTextHeight / 2

    const range = this.props.scale?.range() || [0, 0]
    const innerWidth = range[1] - range[0]
    const xCenter = innerWidth / 2

    /* <text> element's y coordinate is anchored on the middle baseline,
    so we need to shift the element up by half of it's height */
    const labelBBoxHeight = this.labelBBox?.height ?? 0
    let xLabelY = this.props.translateY + labelBBoxHeight + this.AXIS_TITLE_PADDING + xLabelTextHeight / 2

    const xBorderX = xCenter - xLabelTextWidth / 2 - this.axisTitlePaddingLeft
    let xBorderY = xLabelY - halfTextHeight - this.axisTitlePaddingTop
    // if (this.props.enableAjaxTableData) {
    //   // Add extra space for row count display
    //   xBorderY = xBorderY - 20
    //   xLabelY = xLabelY - 20
    // }
    const xBorderWidth = xLabelTextWidth + 2 * this.axisTitlePaddingLeft
    const xBorderHeight = xLabelTextHeight + 2 * this.axisTitlePaddingTop

    return (
      <g>
        <text
          ref={(r) => (this.xTitleRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          y={xLabelY}
          x={xCenter}
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitle(xAxisTitle, this.props.hasXDropdown)}
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

  renderYAxisTitle = (yAxisTitle) => {
    const range = this.props.scale?.range() || [0, 0]
    const innerHeight = range[0] - range[1]
    const yCenter = -1 * (this.props.deltaY + innerHeight / 2)

    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.yTitleRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0

    const yLabelTextHeight = this.getLabelTextHeight(this.yTitleRef)

    const yLabelTop = yLabelBoundingRect?.top
    const chartTop = chartBoundingRect?.top

    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxWidth = this.labelBBox?.width ?? 0
    const yLabelY = -1 * (labelBBoxWidth + this.AXIS_TITLE_PADDING + yLabelTextHeight / 2)
    let yLabelX = yCenter

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
      const topDifference = Math.floor(yLabelTop - chartTop - this.axisTitlePaddingLeft)

      this.topDifference = topDifference + prevTopDifference
      this.yLabelTransform = `rotate(-90) translate(${this.topDifference}, 0)`
    } else if (this.originalYLabelHeight < chartContainerHeight) {
      this.yLabelTransform = undefined
      this.topDifference = undefined
    }

    const yBorderWidth = yLabelHeight + 2 * this.axisTitlePaddingLeft
    const yBorderHeight = yLabelTextHeight + 2 * this.axisTitlePaddingTop
    const yBorderX = yLabelX - yLabelHeight / 2 - this.axisTitlePaddingLeft
    const yBorderY = yLabelY - yLabelWidth / 2 - this.axisTitlePaddingTop

    const transform = this.yLabelTransform || 'rotate(-90)'

    return (
      <g>
        <text
          ref={(r) => (this.yTitleRef = r)}
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
          {this.renderAxisTitle(yAxisTitle, this.props.hasYDropdown)}
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
              y: yBorderY,
            }}
          />
        )}
      </g>
    )
  }

  render = () => {
    // const numSeries = this.props.numberColumnIndices?.length || 0
    // const legendDx = (this.LEGEND_PADDING * (numSeries - 1)) / 2
    // const marginLeft = this.props.leftMargin || 0

    let legendClippingHeight =
      this.props.height -
      this.props.topMargin -
      // make legend smaller if labels are not rotated
      // because they might overlap the legend
      (!this.props.rotateLabels ? this.props.bottomMargin : 44) + // distance to bottom of axis labels
      20
    if (legendClippingHeight < 0) {
      legendClippingHeight = 0
    }

    return (
      <g data-test='axis'>
        <g
          className={`axis axis-${this.props.orient}
            ${this.props.rotateLabels ? ' rotated' : ''}`}
          ref={(el) => (this.axisElement = el)}
          transform={`translate(${this.props.translateX}, ${this.props.translateY})`}
        />
        {this.props.orient === 'Left' && this.renderYAxisTitle(this.props.yAxisTitle || this.props.yCol?.display_name)}
        {this.props.orient === 'Bottom' &&
          this.renderXAxisTitle(this.props.xAxisTitle || this.props.xCol?.display_name)}
        {!!this.labelBBox && this.props.scale?.type === 'LINEAR' && this.props.scale?.domain().length !== 1 && (
          <AxisScaler
            {...this.props}
            positions={['top', 'bottom']}
            align='center'
            childProps={{
              ref: (r) => (this.axisScaler = r),
              x: _get(this.labelBBox, 'x', 0) - this.BUTTON_PADDING,
              y: _get(this.labelBBox, 'y', 0) - this.BUTTON_PADDING,
              width: _get(this.labelBBox, 'width', 0) + this.BUTTON_PADDING * 2,
              height: _get(this.labelBBox, 'height', 0) + this.BUTTON_PADDING * 2,
            }}
          />
        )}
      </g>
    )
  }
}
