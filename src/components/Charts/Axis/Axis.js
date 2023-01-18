import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'
import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'

import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'
import LoadMoreDropdown from './LoadMoreDropdown'

import { formatChartLabel, getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes, mergeBboxes, labelsShouldRotate } from '../helpers.js'

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
    this._isMounted = true
    this.renderAxis()

    // Render a second time so the title knows where to be placed
    // based on the width of the tick labels
    this.setState({ axisRenderComplete: true })
  }

  componentDidUpdate = (prevProps, prevState) => {
    const renderJustCompleted = this.state.axisRenderComplete && !prevState.axisRenderComplete
    this.renderAxis(renderJustCompleted)
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  renderAxis = (renderComplete) => {
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

    const tickValues = this.props.scale?.tickLabels
    if (tickValues?.length) {
      axis.tickValues(tickValues)
    }

    if (this.props.orient === 'Left' && this.props.innerWidth) {
      axis.tickSizeInner(-this.props.innerWidth)
    } else if (this.props.orient === 'Bottom' && this.props.innerHeight) {
      axis.tickSizeInner(this.props.innerHeight)
    } else {
      axis.tickSizeInner(0)
    }

    if (this.axisElement) {
      select(this.axisElement).call(axis)
    }

    if (this.props.orient === 'Bottom' && this.props.scale?.type === 'BAND') {
      select(this.axisElement).selectAll('.tick text').attr('dy', '15px')
    }

    if (this.props.orient === 'Bottom' || this.props.orient === 'Top') {
      // check if labels need to be rotated...
      const labelsOverlap = labelsShouldRotate(this.axisElement)

      if (labelsOverlap) {
        if (this.props.orient === 'Bottom') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'end')
            .attr('dominant-baseline', 'text-top')
            .attr('transform', `rotate(-45, 0, ${this.props.innerHeight})`)
            .attr('dy', '1em')
            .attr('dx', '-1em')
        } else if (this.props.orient === 'Top') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'start')
            .attr('dominant-baseline', 'auto')
            .attr('transform', `rotate(-45, 0, 0)`)
            .attr('dy', '-0.5em')
        }
      }

      this.prevLabelsShouldRotate = this.labelsShouldRotate
      this.labelsShouldRotate = labelsOverlap
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

    if (this.props.scale?.type !== 'LINEAR') {
      select(this.axisElement).selectAll('g.tick').select('line').style('opacity', 0)
    } else {
      select(this.axisElement)
        .selectAll('.axis line')
        .style('stroke-width', '1px')
        .style('stroke', 'currentColor')
        .style('opacity', '0.08')
        .style('shape-rendering', 'crispedges')

      select(this.axisElement).selectAll('g.tick').select('line').style('opacity', 0.1)

      // Make tick line at 0 darker
      select(this.axisElement)
        .selectAll('g.tick')
        .filter((d) => d == 0)
        .select('line')
        .style('opacity', 0.3)
    }

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

      // adjust position of axis title
      if (this.props.orient === 'Bottom') {
        const labelBBoxHeight = this.labelBBox?.height ?? 0
        const xLabelX = this.props.innerWidth / 2
        const xLabelY = this.props.innerHeight + labelBBoxHeight + 2 * this.AXIS_TITLE_PADDING

        select(this.titleRef).attr('x', xLabelX).attr('y', xLabelY)
        select(this.loadMoreDropdown).attr('transform', `translate(${this.props.innerWidth / 2}, ${xLabelY + 15})`)
      }

      const titleBBox = getBBoxFromRef(this.titleRef)
      const titleHeight = titleBBox?.height ?? 0
      const titleWidth = titleBBox?.width ?? 0

      select(this.axisSelector?.ref?.popoverRef)
        .attr('width', titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT)
        .attr('height', titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP)
        .attr('x', titleBBox?.x - this.AXIS_TITLE_BORDER_PADDING_LEFT)
        .attr('y', titleBBox?.y - this.AXIS_TITLE_BORDER_PADDING_TOP)
        .attr('transform', this.titleRef?.getAttribute('transform'))

      select(this.axisScaler)
        .attr('x', (this.labelBBox?.x ?? 0) - this.BUTTON_PADDING)
        .attr('y', (this.labelBBox?.y ?? 0) - this.BUTTON_PADDING)
        .attr('width', (this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2)
        .attr('height', (this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2)
    }

    if (renderComplete) {
      this.props.onAxisRenderComplete(this.props.orient)
    } else if (this.prevLabelsShouldRotate !== this.labelsShouldRotate) {
      this.props.onLabelRotation()
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
    const xLabelBbox = getBBoxFromRef(this.titleRef)
    const titleTextHeight = this.getTitleTextHeight(this.titleRef)

    const labelBBoxHeight = this.labelBBox?.height ?? 0

    const xLabelX = this.props.innerWidth / 2
    const xLabelY = this.props.innerHeight + labelBBoxHeight + 2 * this.AXIS_TITLE_PADDING

    const xLabelHeight = xLabelBbox?.height ?? 0
    const xLabelWidth = xLabelBbox?.width ?? 0

    const xBorderWidth = xLabelWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
    const xBorderHeight = titleTextHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP
    const xBorderX = xLabelX - xLabelWidth / 2 - this.AXIS_TITLE_BORDER_PADDING_LEFT
    const xBorderY = xLabelY - xLabelHeight / 2 - this.AXIS_TITLE_BORDER_PADDING_TOP

    return (
      <g>
        <text
          ref={(r) => (this.titleRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          x={xLabelX}
          y={xLabelY}
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        <AxisSelector
          ref={(r) => (this.axisSelector = r)}
          chartContainerRef={this.props.chartContainerRef}
          changeNumberColumnIndices={this.props.changeNumberColumnIndices}
          changeStringColumnIndex={this.props.changeStringColumnIndex}
          legendColumn={this.props.legendColumn}
          popoverParentElement={this.props.popoverParentElement}
          rebuildTooltips={this.props.rebuildTooltips}
          numberColumnIndices={this.props.numberColumnIndices}
          numberColumnIndices2={this.props.numberColumnIndices2}
          stringColumnIndices={this.props.stringColumnIndices}
          stringColumnIndex={this.props.stringColumnIndex}
          tooltipID={this.props.tooltipID}
          hidden={!this.props.hasDropdown}
          column={this.props.col}
          columns={this.props.columns}
          positions={['top', 'bottom']}
          align='center'
          childProps={{
            x: xBorderX,
            y: xBorderY,
            width: xBorderWidth,
            height: xBorderHeight,
          }}
        />
      </g>
    )
  }

  renderLeftAxisTitle = () => {
    const { title } = this.props
    const yCenter = -0.5 * this.props.innerHeight

    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.titleRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0

    const yLabelTextHeight = this.getTitleTextHeight(this.titleRef)

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
          ref={(r) => (this.titleRef = r)}
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
        <AxisSelector
          ref={(r) => (this.axisSelector = r)}
          chartContainerRef={this.props.chartContainerRef}
          changeNumberColumnIndices={this.props.changeNumberColumnIndices}
          changeStringColumnIndex={this.props.changeStringColumnIndex}
          legendColumn={this.props.legendColumn}
          popoverParentElement={this.props.popoverParentElement}
          rebuildTooltips={this.props.rebuildTooltips}
          numberColumnIndices={this.props.numberColumnIndices}
          numberColumnIndices2={this.props.numberColumnIndices2}
          stringColumnIndices={this.props.stringColumnIndices}
          stringColumnIndex={this.props.stringColumnIndex}
          tooltipID={this.props.tooltipID}
          hidden={!this.props.hasDropdown}
          column={this.props.col}
          columns={this.props.columns}
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
      </g>
    )
  }

  renderRightAxisTitle = () => {
    const { title } = this.props
    const yCenter = -0.5 * this.props.innerHeight

    const chartBoundingRect = this.props.chartContainerRef?.getBoundingClientRect()
    const yLabelBoundingRect = this.titleRef?.getBoundingClientRect()

    const chartContainerHeight = chartBoundingRect?.height ?? 0
    const yLabelHeight = yLabelBoundingRect?.height ?? 0
    const yLabelWidth = yLabelBoundingRect?.width ?? 0

    const yLabelTextHeight = this.getTitleTextHeight(this.titleRef)

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
          ref={(r) => (this.titleRef = r)}
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
        <AxisSelector
          ref={(r) => (this.axisSelector = r)}
          chartContainerRef={this.props.chartContainerRef}
          changeNumberColumnIndices={this.props.changeNumberColumnIndices}
          changeStringColumnIndex={this.props.changeStringColumnIndex}
          legendColumn={this.props.legendColumn}
          popoverParentElement={this.props.popoverParentElement}
          rebuildTooltips={this.props.rebuildTooltips}
          numberColumnIndices={this.props.numberColumnIndices}
          numberColumnIndices2={this.props.numberColumnIndices2}
          stringColumnIndices={this.props.stringColumnIndices}
          stringColumnIndex={this.props.stringColumnIndex}
          tooltipID={this.props.tooltipID}
          hidden={!this.props.hasDropdown}
          column={this.props.col}
          columns={this.props.columns}
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
      </g>
    )
  }

  renderTopAxisTitle = () => {
    // const xLabelBbox = getBBoxFromRef(this.titleRef)
    // const titleTextHeight = this.getTitleTextHeight(this.titleRef)
    // const labelBBoxHeight = this.labelBBox?.height ?? 0
    // const xLabelX = this.props.innerWidth / 2
    // const xLabelY = this.props.innerHeight + labelBBoxHeight + 2 * this.AXIS_TITLE_PADDING
    // const xLabelHeight = xLabelBbox?.height ?? 0
    // const xLabelWidth = xLabelBbox?.width ?? 0
    // const xBorderWidth = xLabelWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
    // const xBorderHeight = titleTextHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP
    // const xBorderX = xLabelX - xLabelWidth / 2 - this.AXIS_TITLE_BORDER_PADDING_LEFT
    // const xBorderY = xLabelY - xLabelHeight / 2 - this.AXIS_TITLE_BORDER_PADDING_TOP
    // return (
    //   <g>
    //     <text
    //       ref={(r) => (this.titleRef = r)}
    //       className='x-axis-label'
    //       data-test='x-axis-label'
    //       dominantBaseline='middle'
    //       textAnchor='middle'
    //       fontWeight='bold'
    //       x={xLabelX}
    //       y={xLabelY}
    //       style={this.labelInlineStyles}
    //     >
    //       {this.renderAxisTitleText()}
    //     </text>
    //     <AxisSelector
    //       ref={(r) => (this.axisSelector = r)}
    //       chartContainerRef={this.props.chartContainerRef}
    //       changeNumberColumnIndices={this.props.changeNumberColumnIndices}
    //       changeStringColumnIndex={this.props.changeStringColumnIndex}
    //       legendColumn={this.props.legendColumn}
    //       popoverParentElement={this.props.popoverParentElement}
    //       rebuildTooltips={this.props.rebuildTooltips}
    //       numberColumnIndices={this.props.numberColumnIndices}
    //       numberColumnIndices2={this.props.numberColumnIndices2}
    //       stringColumnIndices={this.props.stringColumnIndices}
    //       stringColumnIndex={this.props.stringColumnIndex}
    //       tooltipID={this.props.tooltipID}
    //       hidden={!this.props.hasDropdown}
    //       column={this.props.col}
    //       columns={this.props.columns}
    //       positions={['top', 'bottom']}
    //       align='center'
    //       childProps={{
    //         x: xBorderX,
    //         y: xBorderY,
    //         width: xBorderWidth,
    //         height: xBorderHeight,
    //       }}
    //     />
    //   </g>
    // )
  }

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

    const titleBBox = getBBoxFromRef(this.titleRef)

    return (
      <g
        ref={(r) => (this.loadMoreDropdown = r)}
        // transform={`translate(${this.props.innerWidth / 2}, ${titleBBox?.y + titleBBox?.height})`}
      >
        <LoadMoreDropdown {...this.props} />
      </g>
    )
  }

  shouldRenderAxisScaler = () => {
    return !!this.labelBBox && this.props.scale?.type === 'LINEAR' && this.props.scale?.domain().length !== 1
  }

  renderAxisScaler = () => {
    return (
      this.shouldRenderAxisScaler() && (
        <AxisScaler
          toggleChartScale={this.props.toggleChartScale}
          labelBBox={this.labelBBox}
          childProps={{
            ref: (r) => (this.axisScaler = r),
            x: (this.labelBBox?.x ?? 0) - this.BUTTON_PADDING,
            y: (this.labelBBox?.y ?? 0) - this.BUTTON_PADDING,
            width: (this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2,
            height: (this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2,
          }}
        />
      )
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
    //   (!this.state.rotateLabels ? 0 : 44) + // distance to bottom of axis labels
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
        <g className={`axis axis-${this.props.orient}`} ref={(el) => (this.axisElement = el)} />
        {this.renderAxisTitle()}
        {this.renderLoadMoreDropdown()}
        {this.renderAxisScaler()}
      </g>
    )
  }
}
