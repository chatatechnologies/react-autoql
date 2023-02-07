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
    this.AXIS_TITLE_PADDING = 20
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

    this.labelsShouldRotate = false
    this.prevLabelsShouldRotate = false

    this.state = {
      currentRowNumber: this.props.dataLength,
    }
  }

  static propTypes = {
    ...axesPropTypes,
    scale: PropTypes.func.isRequired,
    orient: PropTypes.string,
    translateX: PropTypes.number,
    translateY: PropTypes.number,
  }

  static defaultProps = {
    ...axesDefaultProps,
    orient: 'Bottom',
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

  setScale = (axis) => {
    axis.scale(this.props.scale)
  }

  setTickValues = (axis) => {
    const { scale } = this.props
    axis.tickFormat(function (d) {
      return formatChartLabel({ d, scale })?.formattedLabel
    })

    const tickValues = this.props.scale?.tickLabels
    if (tickValues?.length) {
      axis.tickValues(tickValues)
    }
  }

  setTickSize = (axis) => {
    axis.tickSizeOuter(0)
    if (this.props.orient === 'Left' && this.props.innerWidth) {
      axis.tickSizeInner(-this.props.innerWidth)
    } else if (this.props.orient === 'Bottom' && this.props.innerHeight) {
      axis.tickSizeInner(this.props.innerHeight)
    } else {
      axis.tickSizeInner(0)
    }
  }

  applyAxis = (axis) => {
    if (this.axisElement) {
      select(this.axisElement).call(axis)
    }
  }

  styleAxisLabels = () => {
    if (this.props.orient === 'Bottom') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(0, 5)')
    } else if (this.props.orient === 'Top') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(0, -5)')
    } else if (this.props.orient === 'Left') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(-5, 0)')
    } else if (this.props.orient === 'Right') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(5, 0)')
    }
  }

  rotateLabelsIfNeeded = () => {
    if (this.props.orient === 'Bottom' || this.props.orient === 'Top') {
      // check if labels need to be rotated...
      const labelsOverlap = labelsShouldRotate(this.axisElement)

      if (labelsOverlap) {
        if (this.props.orient === 'Bottom') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'end')
            .attr('dominant-baseline', 'text-top')
            .attr('transform', `rotate(-45, 0, ${this.props.innerHeight}) translate(-6, 2)`)
        } else if (this.props.orient === 'Top') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'start')
            .attr('dominant-baseline', 'auto')
            .attr('transform', `rotate(-45, 0, 0) translate(5, 0)`)
        }
      }

      this.prevLabelsShouldRotate = this.labelsShouldRotate
      this.labelsShouldRotate = labelsOverlap
    }
  }

  addTooltipsToLabels = () => {
    const { scale } = this.props

    select(this.axisElement)
      .selectAll('.axis text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '1')
      .style('font-family', 'inherit')
      .attr('data-for', this.props.chartTooltipID)
      .attr('data-tip', function (d) {
        const { fullWidthLabel, isTruncated } = formatChartLabel({ d, scale })
        return isTruncated ? fullWidthLabel : null
      })
      .attr('data-effect', 'float')
  }

  renderAxis = (renderComplete) => {
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

    this.setScale(axis)
    this.setTickValues(axis)
    this.setTickSize(axis)
    this.applyAxis(axis)
    this.styleAxisLabels()
    this.rotateLabelsIfNeeded()
    this.addTooltipsToLabels()

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
      const axisBBox = this.axisElement.getBBox ? this.axisElement.getBBox() : undefined
      const axisBoundingRect = this.axisElement.getBoundingClientRect
        ? this.axisElement.getBoundingClientRect()
        : undefined

      let xDiff = 0
      let yDiff = 0
      if (!!axisBBox && !!axisBoundingRect) {
        xDiff = axisBoundingRect?.x - axisBBox?.x
        yDiff = axisBoundingRect?.y - axisBBox?.y
      }

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
    }

    this.adjustTitleToFit()
    this.adjustAxisSelectorBorder()
    this.adjustAxisScalerBorder()

    if (renderComplete) {
      this.props.onAxisRenderComplete(this.props.orient)
    } else if (this.state.axisRenderComplete && this.prevLabelsShouldRotate !== this.labelsShouldRotate) {
      this.props.onLabelRotation()
    }
  }

  getTitleTextHeight = () => {
    const fontSize = parseInt(this.titleRef?.style?.fontSize, 10)
    return isNaN(fontSize) ? 12 : fontSize
  }

  openSelector = () => {
    this.setState({ isAxisSelectorOpen: true })
  }

  closeSelector = () => {
    this.setState({ isAxisSelectorOpen: false })
  }

  renderAxisSelector = ({ positions, isSecondAxis, childProps = {} }) => {
    return (
      <AxisSelector
        chartType={this.props.type}
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
        isAggregation={this.props.isAggregation}
        tooltipID={this.props.tooltipID}
        hidden={!this.props.hasDropdown}
        columns={this.props.columns}
        scale={this.props.scale}
        align='center'
        position='right'
        positions={positions}
        childProps={childProps}
        hasSecondAxis={this.props.hasSecondAxis}
        axisSelectorRef={(r) => (this.axisSelector = r)}
        isOpen={this.state.isAxisSelectorOpen}
        closeSelector={this.closeSelector}
        isSecondAxis={isSecondAxis}
      >
        <rect
          className={`axis-label-border ${this.props.hidden ? 'hidden' : ''}`}
          data-test='axis-label-border'
          onClick={this.openSelector}
          fill='transparent'
          stroke='transparent'
          strokeWidth='1px'
          rx='4'
        />
      </AxisSelector>
    )
  }

  renderAxisTitleText = () => {
    const { scale, hasDropdown } = this.props
    const title = scale?.title ?? ''

    if (title.length > 35) {
      return (
        <tspan data-tip={title} data-for={this.props.chartTooltipID} data-test='axis-label'>
          {`${title.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan data-test='axis-label'>
        <tspan ref={(r) => (this.titleText = r)}>{title}</tspan>
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
    const labelBBoxBottom = (this.labelBBox?.y ?? 0) + (this.labelBBox?.height ?? 0)
    const xLabelX = this.props.innerWidth / 2
    const xLabelY = labelBBoxBottom + this.AXIS_TITLE_PADDING

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
        {this.renderAxisSelector({
          positions: ['top', 'bottom', 'left', 'right'],
        })}
      </g>
    )
  }

  renderLeftAxisTitle = () => {
    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxX = this.labelBBox?.x ?? 0
    const yLabelY = labelBBoxX - this.AXIS_TITLE_PADDING
    const yLabelX = -0.5 * this.props.innerHeight

    const transform = 'rotate(-90)'

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
          textLength={10}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.renderAxisSelector({
          // positions: ['right', 'bottom', 'left', 'top'],
          positions: ['right'],
        })}
      </g>
    )
  }

  renderRightAxisTitle = () => {
    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxRightX = (this.labelBBox?.x ?? 0) + (this.labelBBox?.width ?? 0)
    const yLabelY = labelBBoxRightX + this.AXIS_TITLE_PADDING
    const yLabelX = -0.5 * this.props.innerHeight

    const transform = 'rotate(-90)'

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
          textLength={10}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.renderAxisSelector({
          isSecondAxis: true,
          positions: ['left', 'top', 'bottom', 'right'],
          // childProps: {
          //   transform,
          // },
        })}
      </g>
    )
  }

  renderTopAxisTitle = () => {
    const labelBBoxY = this.labelBBox?.y ?? 0
    const xLabelX = this.props.innerWidth / 2
    const xLabelY = labelBBoxY - this.AXIS_TITLE_PADDING

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
        {this.renderAxisSelector({
          isSecondAxis: true,
          positions: ['bottom', 'top', 'left', 'right'],
        })}
      </g>
    )
  }

  adjustAxisSelectorBorder = () => {
    const titleBBox = getBBoxFromRef(this.titleRef)
    const titleHeight = titleBBox?.height ?? 0
    const titleWidth = titleBBox?.width ?? 0

    select(this.axisSelector)
      .attr('transform', this.titleRef?.getAttribute('transform'))
      .attr('width', Math.round(titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT))
      .attr('height', Math.round(titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP))
      .attr('x', Math.round(titleBBox?.x - this.AXIS_TITLE_BORDER_PADDING_LEFT))
      .attr('y', Math.round(titleBBox?.y - this.AXIS_TITLE_BORDER_PADDING_TOP))
  }

  adjustAxisScalerBorder = () => {
    select(this.axisScaler)
      .attr('x', Math.round((this.labelBBox?.x ?? 0) - this.BUTTON_PADDING))
      .attr('y', Math.round((this.labelBBox?.y ?? 0) - this.BUTTON_PADDING))
      .attr('width', Math.round((this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2))
      .attr('height', Math.round((this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2))
  }

  adjustTitleToFit = () => {
    if (this.props.orient === 'Bottom') {
      const labelBBoxBottom = (this.labelBBox?.y ?? 0) + (this.labelBBox?.height ?? 0)
      const xLabelX = this.props.innerWidth / 2
      const xLabelY = labelBBoxBottom + this.AXIS_TITLE_PADDING

      select(this.titleRef).attr('x', xLabelX).attr('y', xLabelY)
      select(this.loadMoreDropdown).attr('transform', `translate(${xLabelX}, ${xLabelY + 15})`)
    } else if (this.props.orient === 'Top') {
      const labelBBoxTop = this.labelBBox?.y ?? 0
      const xLabelX = this.props.innerWidth / 2
      const xLabelY = labelBBoxTop - this.AXIS_TITLE_PADDING

      select(this.titleRef).attr('x', xLabelX).attr('y', xLabelY)
    } else if (this.props.orient === 'Left' || this.props.orient === 'Right') {
      if (this.props.chartRef) {
        // Get original container height and top before adding axis title
        const chartContainerBBox = this.props.chartRef?.getBoundingClientRect()
        const chartContainerHeight = chartContainerBBox?.height
        const chartContainerTop = chartContainerBBox?.y
        select(this.titleRef).attr('textLength', null)
        const yLabelBBox = this.titleRef.getBoundingClientRect()
        const yLabelHeight = (yLabelBBox.height ?? 0) + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
        if (yLabelHeight > chartContainerHeight) {
          // Squeeze text to fit in full height
          let textLength = Math.floor(chartContainerHeight) - 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
          if (textLength < 0) {
            textLength = 10
          }
          select(this.titleRef).attr('textLength', textLength)
        }
        const yLabelBBoxAfterTextLength = this.titleRef.getBoundingClientRect()
        const yTitleTop = yLabelBBoxAfterTextLength.top - this.AXIS_TITLE_BORDER_PADDING_LEFT
        if (yTitleTop < chartContainerTop) {
          const overflow = chartContainerTop - yTitleTop
          select(this.titleRef).attr('transform', `rotate(-90) translate(${-overflow}, 0)`)
        }
      }
    }
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

    return (
      <g ref={(r) => (this.loadMoreDropdown = r)}>
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
            // x: (this.labelBBox?.x ?? 0) - this.BUTTON_PADDING,
            // y: (this.labelBBox?.y ?? 0) - this.BUTTON_PADDING,
            // width: (this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2,
            // height: (this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2,
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
