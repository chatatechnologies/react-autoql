import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'

import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'
import LoadMoreDropdown from './LoadMoreDropdown'

import { formatChartLabel, getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes, mergeBboxes } from '../helpers.js'

import './Axis.scss'

export default class Axis extends Component {
  constructor(props) {
    super(props)

    this.AXIS_KEY = uuid()
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.AXIS_TITLE_PADDING = 15
    this.AXIS_TITLE_BORDER_PADDING_LEFT = 10
    this.AXIS_TITLE_BORDER_PADDING_TOP = 5
    this.swatchElements = []
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
    onAxisRenderComplete: () => {},
  }

  componentDidMount = () => {
    this.renderAxis()
    // Render a second time so the title knows where to be placed
    // based on the width of the tick labels
    this.forceUpdate(() => {
      this.props.onAxisRenderComplete()
    })
  }

  componentDidUpdate = (prevProps) => {
    this.renderAxis()

    // if (this.props.rotateLabels !== prevProps.rotateLabels) {
    //   this.props.onLabelChange()
    // }
  }

  // styleAxisScalerBorder = () => {
  //   select(this.axisScaler)
  //     .attr('class', 'axis-scaler-border')
  //     .attr('transform', `translate(${this.props.translateX ?? 0}, ${this.props.translateY ?? 0})`)
  //     .attr('width', (this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2)
  //     .attr('height', (this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2)
  //     .attr('x', (this.labelBBox?.x ?? 0) - this.BUTTON_PADDING)
  //     .attr('y', (this.labelBBox?.y ?? 0) - this.BUTTON_PADDING)
  //     .attr('stroke', 'transparent')
  //     .attr('stroke-width', '1px')
  //     .attr('fill', 'transparent')
  //     .attr('rx', 4)
  // }

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
    } else if (this.props.orient === 'Bottom') {
      axis.tickSizeInner(10)
    } else if (this.props.orient === 'Right') {
      axis.tickSizeInner(0)
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
        .attr('dy', '1em')
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

          // const left = textBoundingRect.left - xDiff
          // const bottom = textBoundingRect.bottom - yDiff
          // const right = textBoundingRect.right - xDiff
          // const top = textBoundingRect.top - yDiff
          // const textBBox = { left, bottom, right, top }

          labelBboxes.push({
            left: textBoundingRect.left - xDiff,
            bottom: textBoundingRect.bottom - yDiff,
            right: textBoundingRect.right - xDiff,
            top: textBoundingRect.top - yDiff,
          })
        })

      if (labelBboxes) {
        const allLabelsBbox = mergeBboxes(labelBboxes)
        this.labelBBox = { ...allLabelsBbox }
      }

      // if (this.props.scale?.type === 'LINEAR') {
      //   this.styleAxisScalerBorder()
      // }
    }
  }

  getTitleTextHeight = (ref) => {
    const fontSize = parseInt(ref?.style?.fontSize, 10)
    return isNaN(fontSize) ? 0 : fontSize
  }

  renderAxisTitleText = () => {
    const { title = '', hasDropdown } = this.props
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

  renderBottomAxisTitle = () => {
    const xLabelBbox = getBBoxFromRef(this.bottomTitleRef)
    const xLabelTextWidth = xLabelBbox ? xLabelBbox.width : 0
    const xLabelTextHeight = this.getTitleTextHeight(this.bottomTitleRef)
    const halfTextHeight = xLabelTextHeight / 2

    const range = this.props.scale?.range() || [0, 0]
    const innerWidth = range[1] - range[0]
    const xCenter = innerWidth / 2

    /* <text> element's y coordinate is anchored on the middle baseline,
    so we need to shift the element up by half of it's height */
    const labelBBoxYBottom = (this.labelBBox?.y ?? 0) + (this.labelBBox?.height ?? 0)
    let xLabelY = labelBBoxYBottom + this.AXIS_TITLE_PADDING + 0.5 * xLabelTextHeight

    const xBorderX = xCenter - xLabelTextWidth / 2 - this.AXIS_TITLE_BORDER_PADDING_LEFT
    let xBorderY = xLabelY - halfTextHeight - this.AXIS_TITLE_BORDER_PADDING_TOP
    // if (this.props.enableAjaxTableData) {
    //   // Add extra space for row count display
    //   xBorderY = xBorderY - 20
    //   xLabelY = xLabelY - 20
    // }
    const xBorderWidth = xLabelTextWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
    const xBorderHeight = xLabelTextHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP

    return (
      <g>
        <text
          ref={(r) => (this.bottomTitleRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          y={xLabelY}
          x={xCenter}
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.props.hasDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.col}
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

  renderLeftAxisTitle = () => {
    const { title } = this.props
    const range = this.props.scale?.range() || [0, 0]
    const innerHeight = range[0] - range[1]
    const yCenter = -0.5 * innerHeight

    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.leftTitleRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0

    const yLabelTextHeight = this.getTitleTextHeight(this.leftTitleRef)

    const yLabelTop = yLabelBoundingRect?.top
    const chartTop = chartBoundingRect?.top

    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxX = this.labelBBox?.x ?? 0
    const yLabelY = labelBBoxX - this.AXIS_TITLE_PADDING - 0.5 * yLabelTextHeight
    let yLabelX = yCenter

    if (title !== this.previousLeftAxisTitle) {
      // Label changed, reset all svg transforms
      this.originalYLabelHeight = undefined
      this.yLabelTransform = undefined
      this.topDifference = undefined
      this.justChangedYLabel = true
    } else if (this.justChangedYLabel) {
      this.originalYLabelHeight = yLabelHeight
      this.justChangedYLabel = false
    }
    this.previousLeftAxisTitle = title

    let textLength
    if (this.originalYLabelHeight > chartContainerHeight) {
      // Squeeze text to fit in full height
      this.yLabelTransform = 'rotate(-90)'
      this.topDifference = undefined
      yLabelX = -0.5 * chartContainerHeight
      textLength = Math.floor(chartContainerHeight)
    } else if (yLabelTop < chartTop) {
      // Y Label can fit, it is just outside of container. Shift it down
      const prevTopDifference = this.topDifference ?? 0
      const topDifference = Math.floor(yLabelTop - chartTop - this.AXIS_TITLE_BORDER_PADDING_LEFT)

      this.topDifference = topDifference + prevTopDifference
      this.yLabelTransform = `rotate(-90) translate(${this.topDifference}, 0)`
    } else if (this.originalYLabelHeight < chartContainerHeight) {
      this.yLabelTransform = undefined
      this.topDifference = undefined
    }

    const yBorderWidth = yLabelHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
    const yBorderHeight = yLabelTextHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP
    const yBorderX = yLabelX - yLabelHeight / 2 - this.AXIS_TITLE_BORDER_PADDING_LEFT
    const yBorderY = yLabelY - yLabelWidth / 2 - this.AXIS_TITLE_BORDER_PADDING_TOP

    const transform = this.yLabelTransform || 'rotate(-90)'

    return (
      <g>
        <text
          ref={(r) => (this.leftTitleRef = r)}
          id={`left-axis-title-${this.AXIS_KEY}`}
          className='left-axis-title'
          data-test='left-axis-title'
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
          {this.renderAxisTitleText()}
        </text>
        {this.props.hasDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.col}
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

  renderRightAxisTitle = () => {
    const { title } = this.props
    const range = this.props.scale?.range() || [0, 0]
    const innerHeight = range[0] - range[1]
    const yCenter = -0.5 * innerHeight

    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.rightTitleRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0

    const yLabelTextHeight = this.getTitleTextHeight(this.rightTitleRef)

    const yLabelTop = yLabelBoundingRect?.top
    const chartTop = chartBoundingRect?.top

    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxRightX = (this.labelBBox?.x ?? 0) + (this.labelBBox?.width ?? 0)
    const yLabelY = labelBBoxRightX + this.AXIS_TITLE_PADDING + 0.5 * yLabelTextHeight
    let yLabelX = yCenter

    if (title !== this.previousRightAxisTitle) {
      // Label changed, reset all svg transforms
      this.originalRightTitleHeight = undefined
      this.rightTitleTransform = undefined
      this.rightTitleTopDifference = undefined
      this.justChangedRightTitle = true
    } else if (this.justChangedRightTitle) {
      this.originalRightTitleHeight = yLabelHeight
      this.justChangedRightTitle = false
    }
    this.previousRightAxisTitle = title

    let textLength
    if (this.originalRightTitleHeight > chartContainerHeight) {
      // Squeeze text to fit in full height
      this.rightTitleTransform = 'rotate(-90)'
      this.rightTitleTopDifference = undefined
      yLabelX = -0.5 * chartContainerHeight
      textLength = Math.floor(chartContainerHeight)
    } else if (yLabelTop < chartTop) {
      // Y Label can fit, it is just outside of container. Shift it down
      const prevTopDifference = this.rightTitleTopDifference ?? 0
      const topDifference = Math.floor(yLabelTop - chartTop - this.AXIS_TITLE_BORDER_PADDING_LEFT)

      this.rightTitleTopDifference = topDifference + prevTopDifference
      this.rightTitleTransform = `rotate(-90) translate(${this.rightTitleTopDifference}, 0)`
    } else if (this.originalRightTitleHeight < chartContainerHeight) {
      this.rightTitleTransform = undefined
      this.rightTitleTopDifference = undefined
    }

    const yBorderWidth = yLabelHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
    const yBorderHeight = yLabelTextHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP
    const yBorderX = yLabelX - yLabelHeight / 2 - this.AXIS_TITLE_BORDER_PADDING_LEFT
    const yBorderY = yLabelY - yLabelWidth / 2 - this.AXIS_TITLE_BORDER_PADDING_TOP

    const transform = this.rightTitleTransform || 'rotate(-90)'

    return (
      <g>
        <text
          ref={(r) => (this.rightTitleRef = r)}
          id={`right-axis-title-${this.AXIS_KEY}`}
          className='right-axis-title'
          data-test='right-axis-title'
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
          {this.renderAxisTitleText()}
        </text>
        {this.props.hasDropdown && (
          <AxisSelector
            {...this.props}
            column={this.props.col}
            positions={['left']}
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

  renderTopAxisTitle = () => {}

  renderAxisTitle = () => {
    const { orient } = this.props

    switch (orient) {
      case 'Left': {
        return this.renderLeftAxisTitle()
      }
      case 'Right': {
        return this.renderRightAxisTitle()
      }
      case 'Bottom': {
        return this.renderBottomAxisTitle()
      }
      case 'Top': {
        return this.renderTopAxisTitle()
      }
      default: {
        return null
      }
    }
  }

  renderLoadMoreDropdown = () => {
    if (this.props.orient !== 'Bottom' || !this.props.enableAjaxTableData) {
      return null
    }

    const titleBBox = getBBoxFromRef(this.bottomTitleRef)
    const translateY = (titleBBox?.y ?? 0) + (titleBBox?.height ?? 0)

    return (
      <g transform={`translate(${this.props.innerWidth / 2},${translateY})`}>
        <LoadMoreDropdown {...this.props} />
      </g>
    )
  }

  render = () => {
    // const numSeries = this.props.numberColumnIndices?.length || 0
    // const legendDx = (this.LEGEND_PADDING * (numSeries - 1)) / 2
    // const marginLeft = this.props.leftMargin || 0

    // let legendClippingHeight =
    //   this.props.height -
    //   // this.props.topMargin -
    //   // make legend smaller if labels are not rotated
    //   // because they might overlap the legend
    //   (!this.props.rotateLabels ? 0 : 44) + // distance to bottom of axis labels
    //   20
    // if (legendClippingHeight < 0) {
    //   legendClippingHeight = 0
    // }

    return (
      <g
        data-test='axis'
        ref={(r) => (this.ref = r)}
        transform={`translate(${this.props.translateX}, ${this.props.translateY})`}
      >
        <g
          className={`axis axis-${this.props.orient}
            ${this.props.rotateLabels ? ' rotated' : ''}`}
          ref={(el) => (this.axisElement = el)}
        />
        {this.renderAxisTitle()}
        {this.renderLoadMoreDropdown()}
        {/* {!!this.labelBBox && this.props.scale?.type === 'LINEAR' && this.props.scale?.domain().length !== 1 && (
          <AxisScaler
            setIsChartScaled={this.props.setIsChartScaled}
            childProps={{
              ref: (r) => (this.axisScaler = r),
              x: (this.labelBBox?.x ?? 0) - this.BUTTON_PADDING,
              y: (this.labelBBox?.y ?? 0) - this.BUTTON_PADDING,
              width: (this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2,
              height: (this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2,
            }}
          />
        )} */}
      </g>
    )
  }
}
