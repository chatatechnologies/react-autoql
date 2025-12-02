import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'
import { isMobile } from 'react-device-detect'
import { formatChartLabel, getBBoxFromRef, mergeBoundingClientRects, shouldLabelsRotate } from 'autoql-fe-utils'

import { Legend } from '../Legend'
import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers.js'

import './Axis.scss'

export default class Axis extends Component {
  constructor(props) {
    super(props)

    this.AXIS_KEY = uuid()
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.AXIS_TITLE_PADDING_TOP = 20
    this.AXIS_TITLE_PADDING_BOTTOM = 0
    this.AXIS_TITLE_BORDER_PADDING_LEFT = 5
    this.AXIS_TITLE_BORDER_PADDING_TOP = 3
    this.MINIMUM_TITLE_LENGTH = 10

    this.swatchElements = []
    this.fontSize = isMobile ? 10 : 12
    this.labelInlineStyles = {
      fontSize: `${this.fontSize}px`,
      fontFamily: 'inherit',
      fill: 'currentColor',
      cursor: 'default',
      fontFamily: 'var(--react-autoql-font-family)',
      letterSpacing: 'normal',
    }

    this.shouldLabelsRotate = false
    this.prevShouldLabelsRotate = false

    this.state = {
      isAxisSelectorOpen: false,
    }
  }

  static propTypes = {
    ...chartPropTypes,
    scale: PropTypes.func,
    orient: PropTypes.string,
    translateX: PropTypes.number,
    translateY: PropTypes.number,
  }

  static defaultProps = {
    ...chartDefaultProps,
    orient: 'bottom',
    translate: undefined,
    translateX: 0,
    translateY: 0,
    innerWidth: 0,
    innerHeight: 0,
    outerHeight: 0,
    outerWidth: 0,
    onAxisRenderComplete: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
    this.renderAxis()

    // Render a second time so the title knows where to be placed
    // based on the width of the tick labels
    this.setState({ axisRenderComplete: true })
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.state.isAxisSelectorOpen && nextState.isAxisSelectorOpen) {
      return false
    }

    const propsEqual = _isEqual(this.props, nextProps)
    const stateEqual = _isEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      (!_isEqual(prevProps.visibleSeriesIndices, this.props.visibleSeriesIndices) ||
        prevProps.stringColumnIndex !== this.props.stringColumnIndex) &&
      this.state.isAxisSelectorOpen !== prevState.isAxisSelectorOpen
    ) {
      const isStringColumn = !this.props.scale.fields[0].hasOwnProperty('aggType')
      const requestedData = {
        source: this.props.source,
        chart_type: this.props.type,
        axes: [
          {
            axis: this.props.scale.axis,
            type: this.props.scale.type,
            column: isStringColumn
              ? { name: this.props.scale.column.name, type: this.props.scale.column?.type }
              : this.props.scale.fields.map((field) => ({
                  name: field.name,
                  aggType: field.hasOwnProperty('aggType') ? field.aggType : undefined,
                  type: field.type,
                })),
          },
        ],
      }
      // TODO---Ready to send to Backend
    }

    const renderJustCompleted = this.state.axisRenderComplete && !prevState.axisRenderComplete
    if (!this.state.isAxisSelectorOpen) {
      this.renderAxis(renderJustCompleted)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  onAxisRenderComplete = (orient) => {
    if (orient === 'Legend') {
      this.legendComplete = true
    } else {
      this.axisComplete = true
    }

    if (!this.props.hasLegend && !this.legendComplete) {
      this.legendComplete = true
    }

    if (this.axisComplete && this.legendComplete) {
      this.props.onAxisRenderComplete(this.props.orient)
    }
  }

  setScale = () => {
    this.axis.scale(this.props.scale)
  }

  adjustLegendLocation = () => {
    if (!this.legendContainer) {
      return
    }

    let translateX = 0
    let translateY = 0

    const axisBBox = getBBoxFromRef(this.ref)

    if (this.props.orient === 'right') {
      translateX = axisBBox?.width ?? 0
    } else if (this.props.orient === 'bottom') {
      const centerX = this.props.innerWidth / 2

      const legendBBox = this.legendContainer?.getBBox()
      const legendCenterX = legendBBox.x + legendBBox.width / 2
      const deltaCenter = centerX - legendCenterX

      translateX = deltaCenter
      translateY = axisBBox?.height ?? 0

      const legendRightX = legendBBox.x + legendBBox.width + translateX
      const chartRightX = this.props.outerWidth - this.props.deltaX - this.props.chartPadding
      const rightXDiff = chartRightX - legendRightX
      if (rightXDiff < 0) {
        translateX += rightXDiff
      }
    }

    select(this.legendContainer).attr('transform', `translate (${translateX},${translateY})`)
  }

  getMaxTickLabelWidth = () => {
    const absoluteMin = 6
    const absoluteMax = 100
    const avgCharSize = 6

    const { orient, outerHeight, outerWidth } = this.props
    const isTopOrBottom = orient === 'top' || orient === 'bottom'
    const isLeftOrRight = orient === 'left' || orient === 'right'

    if (isTopOrBottom && !this.shouldLabelsRotate) {
      // It has been checked and the labels indeed do not need to rotate
      return absoluteMax
    }

    let calculatedMax
    if (isTopOrBottom) {
      // Is top or bottom and labels ARE rotated
      // Max width should be 30% of container height
      calculatedMax = Math.floor((0.5 * outerHeight) / avgCharSize)
    } else if (isLeftOrRight) {
      // Left or right should be 30% of inner width
      calculatedMax = Math.floor((0.3 * outerWidth) / avgCharSize)
    }

    let maxLabelWidth = this.maxLabelWidth // Use previous value as baseline
    if (calculatedMax < absoluteMin) {
      maxLabelWidth = absoluteMin
    } else if (calculatedMax < absoluteMax) {
      maxLabelWidth = calculatedMax
    }

    return maxLabelWidth ?? absoluteMax
  }

  setTickValues = () => {
    const { scale } = this.props
    const maxLabelWidth = this.maxLabelWidth
    this.axis.tickFormat(function (d) {
      const label = formatChartLabel({ d, scale, maxLabelWidth })
      if (label?.formattedLabel) {
        return label.formattedLabel
      }

      return d
    })

    if (this.props.scale?.tickLabels?.length) {
      this.axis.tickValues(this.props.scale.tickLabels)
    }

    this.setTickSize()
  }

  setTickSize = () => {
    this.axis.tickSizeOuter(0)
    if (this.props.orient === 'left' && this.props.innerWidth) {
      this.axis.tickSizeInner(-this.props.innerWidth)
    } else if (this.props.orient === 'bottom' && this.props.innerHeight) {
      this.axis.tickSizeInner(this.props.innerHeight)
    } else {
      this.axis.tickSizeInner(0)
    }
  }

  applyAxis = () => {
    if (this.axisElement) {
      select(this.axisElement).call(this.axis)
    }
  }

  styleAxisLabels = () => {
    if (this.props.orient === 'bottom') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(0, 10)')
    } else if (this.props.orient === 'top') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(0, -5)')
    } else if (this.props.orient === 'left') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(-5, 0)')
    } else if (this.props.orient === 'right') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(5, 0)')
    }
  }

  rotateLabelsIfNeeded = () => {
    if (this.props.orient === 'bottom' || this.props.orient === 'top') {
      // check if labels need to be rotated...
      const labelsOverlap = this.shouldLabelsRotate || shouldLabelsRotate(this.axisElement)

      if (labelsOverlap) {
        if (this.props.orient === 'bottom') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'end')
            .attr('dominant-baseline', 'text-top')
            .attr('transform', `rotate(-45, 0, ${this.props.innerHeight}) translate(-10, 0)`)
        } else if (this.props.orient === 'top') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'start')
            .attr('dominant-baseline', 'auto')
            .attr('transform', `rotate(-45, 0, 0) translate(5, 0)`)
        }
      }

      this.shouldLabelsRotate = labelsOverlap
    }
  }

  addTooltipsToLabels = () => {
    const { scale } = this.props
    const maxLabelWidth = this.maxLabelWidth

    select(this.axisElement)
      .selectAll('.axis .tick text')
      .style('fill', 'currentColor')
      .style('fill-opacity', '1')
      .style('font-family', 'inherit')
      .attr('data-tooltip-id', this.props.chartTooltipID)
      .attr('data-tooltip-effect', 'float')
      .attr('data-tooltip-content', function (d) {
        if (select(this).text()?.slice(-3) === '...') {
          const { fullWidthLabel } = formatChartLabel({ d, scale, maxLabelWidth })
          if (fullWidthLabel) {
            return fullWidthLabel
          }
        }
        return ''
      })
  }

  drawAxisAndLabels = () => {
    this.maxLabelWidth = this.getMaxTickLabelWidth()
    this.setTickValues()
    this.applyAxis()
    this.styleAxisLabels()
    this.rotateLabelsIfNeeded()
  }

  renderAxis = (renderComplete) => {
    if (!this.props.scale) {
      return
    }

    this.prevShouldLabelsRotate = this.shouldLabelsRotate

    switch (this.props.orient) {
      case 'bottom': {
        this.axis = axisBottom()
        break
      }
      case 'left': {
        this.axis = axisLeft()
        break
      }
      case 'right': {
        this.axis = axisRight()
        break
      }
      case 'top': {
        this.axis = axisTop()
        break
      }
      default: {
        break
      }
    }

    this.setScale()

    this.drawAxisAndLabels()
    if (this.shouldLabelsRotate && !this.prevShouldLabelsRotate) {
      // Labels needed to rotate, recalculate max label length and redraw
      this.drawAxisAndLabels()
    }

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
        const allLabelsBbox = mergeBoundingClientRects(labelBboxes)
        this.labelsBBox = { ...allLabelsBbox }
      }
    }

    this.adjustTitleToFit()
    this.adjustAxisSelectorBorder()
    this.adjustAxisScalerBorder()
    this.adjustLegendLocation()

    if (renderComplete) {
      this.onAxisRenderComplete(this.props.orient)
    } else if (this.state.axisRenderComplete && this.prevShouldLabelsRotate !== this.shouldLabelsRotate) {
      this.props.onLabelRotation()
    }
  }

  getLegendOrientation = () => {
    switch (this.props.orient.toLowerCase()) {
      case 'right':
      case 'left':
        return 'vertical'

      case 'bottom':
      case 'top':
        return 'horizontal'

      default:
        return
    }
  }

  renderLegend = () => {
    const legendOrientation = this.getLegendOrientation()

    let legendPadding = { top: 0, bottom: 0, left: 20, right: 0 }
    if (legendOrientation === 'horizontal') {
      legendPadding.right = legendPadding.left = this.props.chartPadding
    }

    return (
      <g ref={(r) => (this.legendContainer = r)}>
        <Legend
          {...this.props}
          ref={(r) => (this.legendRef = r)}
          legendColumnIndices={this.props.numberColumnIndices}
          legendColumnIndices2={this.props.numberColumnIndices2}
          placement={this.props.orient}
          onRenderComplete={() => this.onAxisRenderComplete('Legend')}
          paddingBottom={legendPadding.bottom}
          paddingRight={legendPadding.right}
          paddingTop={legendPadding.top}
          paddingLeft={legendPadding.left}
          hasSecondAxis={this.props.hasSecondAxis}
          shape={this.props.legendShape}
          orientation={legendOrientation}
          fontSize={this.fontSize}
        />
      </g>
    )
  }

  getTitleTextHeight = () => {
    const fontSize = parseInt(this.titleRef?.style?.fontSize, this.labelInlineStyles.fontSize)
    return isNaN(fontSize) ? this.fontSize : fontSize
  }

  openSelector = () => {
    this.setState({ isAxisSelectorOpen: true })
  }

  closeSelector = () => {
    this.setState({ isAxisSelectorOpen: false })
  }

  renderAxisSelector = ({ positions, isSecondAxis, childProps = {} }) => {
    const columnsForSelector = this.props.isAggregated ? this.props.originalColumns : this.props.columns

    return (
      <AxisSelector
        chartContainerRef={this.props.chartContainerRef}
        changeNumberColumnIndices={this.props.changeNumberColumnIndices}
        changeStringColumnIndex={this.props.changeStringColumnIndex}
        legendColumn={this.props.legendColumn}
        popoverParentElement={this.props.popoverParentElement}
        numberColumnIndices={this.props.numberColumnIndices}
        numberColumnIndices2={this.props.numberColumnIndices2}
        stringColumnIndices={this.props.stringColumnIndices}
        stringColumnIndex={this.props.stringColumnIndex}
        dateColumnsOnly={this.props.dateColumnsOnly}
        isAggregated={this.props.isAggregated}
        tooltipID={this.props.tooltipID}
        hidden={!this.shouldRenderAxisSelector()}
        columns={columnsForSelector}
        scale={this.props.scale}
        secondScale={this.props.scale?.secondScale}
        align='center'
        position='right'
        positions={positions}
        childProps={childProps}
        hasSecondAxis={this.props.hasSecondAxis}
        axisSelectorRef={(r) => (this.axisSelector = r)}
        isOpen={this.state.isAxisSelectorOpen}
        originalColumns={this.props.originalColumns}
        closeSelector={this.closeSelector}
        isSecondAxis={isSecondAxis}
      >
        <rect
          ref={(r) => (this.axisSelector = r)}
          className={`axis-label-border ${this.shouldRenderAxisSelector() ? '' : 'hidden'}`}
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
    const { scale } = this.props
    const title = scale?.title ?? ''

    if (title.length > 35) {
      return (
        <tspan data-tooltip-content={title} data-tooltip-id={this.props.chartTooltipID} data-test='axis-label'>
          {`${title.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan data-test='axis-label'>
        <tspan ref={(r) => (this.titleText = r)}>{title}</tspan>
        {this.shouldRenderAxisSelector() && (
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
    return (
      <g>
        <text
          ref={(r) => (this.titleRef = r)}
          className='x-axis-label'
          data-test='x-axis-label'
          dominantBaseline='middle'
          textAnchor='middle'
          fontWeight='bold'
          textLength={this.MINIMUM_TITLE_LENGTH}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.renderAxisSelector({
          positions: ['top', 'bottom', 'right', 'left'],
        })}
      </g>
    )
  }

  renderLeftAxisTitle = () => {
    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxX = this.labelsBBox?.x ?? 0
    const yLabelY = labelBBoxX - this.AXIS_TITLE_PADDING_TOP
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
          textLength={this.MINIMUM_TITLE_LENGTH}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.renderAxisSelector({
          positions: ['right', 'bottom', 'left', 'top'],
        })}
      </g>
    )
  }

  renderRightAxisTitle = () => {
    // X and Y are switched from the rotation (anchored in the middle)
    const labelBBoxRightX = (this.labelsBBox?.x ?? 0) + (this.labelsBBox?.width ?? 0)
    const yLabelY = labelBBoxRightX + this.AXIS_TITLE_PADDING_TOP
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
          textLength={this.MINIMUM_TITLE_LENGTH}
          lengthAdjust='spacingAndGlyphs'
          style={this.labelInlineStyles}
        >
          {this.renderAxisTitleText()}
        </text>
        {this.renderAxisSelector({
          isSecondAxis: true,
          positions: ['left', 'top', 'bottom', 'right'],
        })}
      </g>
    )
  }

  renderTopAxisTitle = () => {
    const labelBBoxY = this.labelsBBox?.y ?? 0
    const xLabelX = this.props.innerWidth / 2
    const xLabelY = labelBBoxY - this.AXIS_TITLE_PADDING_TOP

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
    if (!this.titleRef) {
      return
    }

    const titleBBox = getBBoxFromRef(this.titleRef)
    const titleHeight = titleBBox?.height ?? 0
    const titleWidth = titleBBox?.width ?? 0
    const titleX = titleBBox?.x ?? 0
    const titleY = titleBBox?.y ?? 0

    select(this.axisSelector)
      .attr('transform', this.titleRef?.getAttribute('transform'))
      .attr('width', Math.round(titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT))
      .attr('height', Math.round(titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP))
      .attr('x', Math.round(titleX - this.AXIS_TITLE_BORDER_PADDING_LEFT))
      .attr('y', Math.round(titleY - this.AXIS_TITLE_BORDER_PADDING_TOP))
  }

  adjustAxisScalerBorder = () => {
    if (!this.axisScaler) {
      return
    }

    select(this.axisScaler)
      .attr('x', Math.round((this.labelsBBox?.x ?? 0) - this.BUTTON_PADDING))
      .attr('y', Math.round((this.labelsBBox?.y ?? 0) - this.BUTTON_PADDING))
      .attr('width', Math.round((this.labelsBBox?.width ?? 0) + this.BUTTON_PADDING * 2))
      .attr('height', Math.round((this.labelsBBox?.height ?? 0) + this.BUTTON_PADDING * 2))
  }

  adjustBottomTitleToFit = () => {
    const labelBBoxBottom = (this.labelsBBox?.y ?? 0) + (this.labelsBBox?.height ?? 0)
    const xLabelX = this.props.innerWidth / 2
    const xLabelY = labelBBoxBottom + this.AXIS_TITLE_PADDING_TOP

    select(this.titleRef).attr('x', xLabelX).attr('y', xLabelY)

    if (this.props.chartRef) {
      // Get original container width and top before adding axis title
      const chartContainerWidth = this.props.outerWidth - 2 * this.props.chartPadding
      select(this.titleRef).attr('textLength', null)

      const xTitleBBox = this.titleRef.getBBox()

      // ---------------------- Chart width is too small to fit the whole title --------------------
      const xTitleWidth = (xTitleBBox.width ?? 0) + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
      if (xTitleWidth > chartContainerWidth) {
        // Squeeze text to fit in full width
        let textLength = Math.floor(chartContainerWidth) - 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
        if (textLength < 0) {
          textLength = this.MINIMUM_TITLE_LENGTH
        }
        select(this.titleRef).attr('textLength', textLength)
      }
      // --------------------------------------------------------------------------------------------

      // ------------------------- Title will fit, but needs to be shifted left ---------------------
      const xTitleBBoxAfterTextLength = this.titleRef.getBBox()
      const xTitleRight =
        xTitleBBoxAfterTextLength.x +
        xTitleBBoxAfterTextLength.width +
        this.props.deltaX +
        this.AXIS_TITLE_BORDER_PADDING_LEFT

      const chartRight = this.props.outerWidth - this.props.chartPadding

      if (xTitleRight > chartRight) {
        const overflow = xTitleRight - chartRight
        select(this.titleRef).attr('x', xLabelX - overflow)
      }
      // --------------------------------------------------------------------------------------------
    }
  }

  adjustTopTitleToFit = () => {
    const labelBBoxTop = this.labelsBBox?.y ?? 0
    const xLabelX = this.props.innerWidth / 2
    const xLabelY = labelBBoxTop - this.AXIS_TITLE_PADDING_TOP

    select(this.titleRef).attr('x', xLabelX).attr('y', xLabelY)
  }

  adjustVerticalTitleToFit = () => {
    if (this.props.chartRef) {
      // Get original container height and top before adding axis title
      const chartContainerHeight = this.props.outerHeight - 2 * this.props.chartPadding
      select(this.titleRef).attr('textLength', null)

      // BBox x/width and y/height will be switched due to the rotation
      const yTitleBBox = this.titleRef.getBBox()

      // ---------------------- Chart height is too small to fit the whole title --------------------
      const yTitleHeight = (yTitleBBox.width ?? 0) + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
      if (yTitleHeight > chartContainerHeight) {
        // Squeeze text to fit in full height
        let textLength = Math.floor(chartContainerHeight) - 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
        if (textLength < 0) {
          textLength = this.MINIMUM_TITLE_LENGTH
        }
        select(this.titleRef).attr('textLength', textLength)
      }
      // --------------------------------------------------------------------------------------------

      // ------------------------- Title will fit, but needs to be shifted down ---------------------
      const yTitleBBoxAfterTextLength = this.titleRef.getBBox()
      const yTitleTop =
        -1 * (yTitleBBoxAfterTextLength.x + yTitleBBoxAfterTextLength.width) +
        this.props.deltaY -
        this.AXIS_TITLE_BORDER_PADDING_LEFT -
        this.props.chartPadding

      if (yTitleTop < 0) {
        const overflow = -yTitleTop
        select(this.titleRef).attr('transform', `rotate(-90) translate(${-overflow}, 0)`)
      }
      // --------------------------------------------------------------------------------------------
    }
  }

  adjustTitleToFit = () => {
    if (!this.titleRef) {
      return
    }

    if (this.props.orient === 'bottom') {
      this.adjustBottomTitleToFit()
    } else if (this.props.orient === 'top') {
      this.adjustTopTitleToFit()
    } else if (this.props.orient === 'left' || this.props.orient === 'right') {
      this.adjustVerticalTitleToFit()
    }
  }

  renderAxisTitle = () => {
    const { orient } = this.props

    switch (orient) {
      case 'left': {
        return this.renderLeftAxisTitle()
      }
      case 'right': {
        return this.renderRightAxisTitle()
      }
      case 'bottom': {
        return this.renderBottomAxisTitle()
      }
      case 'top': {
        return this.renderTopAxisTitle()
      }
      default: {
        return null
      }
    }
  }

  shouldRenderAxisSelector = () => {
    const { scale, isAggregated, legendLocation, originalColumns, columns } = this.props
    const scaleType = scale?.type
    const isStringAxis = scaleType === 'BAND' || scaleType === 'TIME'

    if (!isStringAxis) {
      return scale?.hasDropdown
    }

    if (isAggregated && legendLocation) {
      return true
    }

    const cols = originalColumns || columns
    const groupableCount = cols?.filter((col) => col?.groupable && col?.is_visible)?.length ?? 0

    return groupableCount > 1 || scale?.hasDropdown
  }

  shouldRenderAxisScaler = () => {
    return (
      !!this.labelsBBox &&
      this.props.scale?.type === 'LINEAR' &&
      this.props.scale?.domain().length !== 1 &&
      !this.props.scale?.disableAutoScale
    )
  }

  renderAxisScaler = () => {
    if (!this.shouldRenderAxisScaler()) {
      return null
    }

    return (
      <AxisScaler
        toggleChartScale={this.props.toggleChartScale}
        labelBBox={this.labelsBBox}
        childProps={{
          ref: (r) => (this.axisScaler = r),
        }}
      />
    )
  }

  render = () => {
    return (
      <>
        {!!this.props.scale && (
          <g
            data-test='axis'
            ref={(r) => (this.ref = r)}
            transform={`translate(${this.props.translateX}, ${this.props.translateY})`}
            style={this.labelInlineStyles}
          >
            <g className={`axis axis-${this.props.orient}`} ref={(el) => (this.axisElement = el)} />
            {this.renderAxisTitle()}
            {this.renderAxisScaler()}
          </g>
        )}
        {this.props.hasLegend && this.renderLegend()}
      </>
    )
  }
}
