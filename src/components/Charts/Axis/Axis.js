import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'

import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'
import LoadMoreDropdown from './LoadMoreDropdown'

import { formatChartLabel, getBBoxFromRef } from '../../../js/Util.js'
import { axesDefaultProps, axesPropTypes, mergeBboxes, shouldLabelsRotate } from '../helpers.js'

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
      fontSize: '13px',
      fontFamily: 'inherit',
      fill: 'currentColor',
      fillOpacity: 0.9,
      cursor: 'default',
    }

    this.shouldLabelsRotate = false
    this.prevShouldLabelsRotate = false

    this.state = {
      isAxisSelectorOpen: false,
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

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.state.isAxisSelectorOpen && nextState.isAxisSelectorOpen) {
      return false
    }

    const propsEqual = _isEqual(this.props, nextProps)
    const stateEqual = _isEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps, prevState) => {
    const renderJustCompleted = this.state.axisRenderComplete && !prevState.axisRenderComplete
    if (!this.state.isAxisSelectorOpen) {
      this.renderAxis(renderJustCompleted)
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  setScale = () => {
    this.axis.scale(this.props.scale)
  }

  getMaxTickLabelWidth = () => {
    const absoluteMin = 6
    const absoluteMax = 100
    const avgCharSize = 6

    const { orient, outerHeight, outerWidth } = this.props
    const isTopOrBottom = orient === 'Top' || orient === 'Bottom'
    const isLeftOrRight = orient === 'Left' || orient === 'Right'

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
    if (this.props.orient === 'Left' && this.props.innerWidth) {
      this.axis.tickSizeInner(-this.props.innerWidth)
    } else if (this.props.orient === 'Bottom' && this.props.innerHeight) {
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
    if (this.props.orient === 'Bottom') {
      select(this.axisElement).selectAll('.tick text').attr('transform', 'translate(0, 10)')
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
      const labelsOverlap = this.shouldLabelsRotate || shouldLabelsRotate(this.axisElement)

      if (labelsOverlap) {
        if (this.props.orient === 'Bottom') {
          select(this.axisElement)
            .selectAll('.tick text')
            .style('text-anchor', 'end')
            .attr('dominant-baseline', 'text-top')
            .attr('transform', `rotate(-45, 0, ${this.props.innerHeight}) translate(-10, 0)`)
        } else if (this.props.orient === 'Top') {
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
      .attr('data-for', this.props.chartTooltipID)
      .attr('data-effect', 'float')
      .attr('data-tip', function (d) {
        if (select(this).text()?.slice(-3) === '...') {
          const { fullWidthLabel } = formatChartLabel({ d, scale, maxLabelWidth })
          if (fullWidthLabel) {
            return fullWidthLabel
          }
        }
        return null
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
    this.prevShouldLabelsRotate = this.shouldLabelsRotate

    switch (this.props.orient) {
      case 'Bottom': {
        this.axis = axisBottom()
        break
      }
      case 'Left': {
        this.axis = axisLeft()
        break
      }
      case 'Right': {
        this.axis = axisRight()
        break
      }
      case 'Top': {
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
        const allLabelsBbox = mergeBboxes(labelBboxes)
        this.labelBBox = { ...allLabelsBbox }
      }
    }

    this.adjustTitleToFit()
    this.adjustAxisSelectorBorder()
    this.adjustAxisScalerBorder()

    if (renderComplete) {
      this.props.onAxisRenderComplete(this.props.orient)
    } else if (this.state.axisRenderComplete && this.prevShouldLabelsRotate !== this.shouldLabelsRotate) {
      this.props.onLabelRotation()
    }
  }

  getTitleTextHeight = () => {
    const fontSize = parseInt(this.titleRef?.style?.fontSize, this.labelInlineStyles.fontSize)
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
        isAggregation={this.props.isAggregation}
        tooltipID={this.props.tooltipID}
        hidden={!this.shouldRenderAxisSelector()}
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
        <tspan data-tip={title} data-for={this.props.chartTooltipID} data-test='axis-label'>
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
          positions: ['top', 'bottom', 'right', 'left'],
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
          positions: ['right', 'bottom', 'left', 'top'],
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
    if (!this.titleRef) {
      return
    }

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
    if (!this.axisScaler) {
      return
    }

    select(this.axisScaler)
      .attr('x', Math.round((this.labelBBox?.x ?? 0) - this.BUTTON_PADDING))
      .attr('y', Math.round((this.labelBBox?.y ?? 0) - this.BUTTON_PADDING))
      .attr('width', Math.round((this.labelBBox?.width ?? 0) + this.BUTTON_PADDING * 2))
      .attr('height', Math.round((this.labelBBox?.height ?? 0) + this.BUTTON_PADDING * 2))
  }

  adjustTitleToFit = () => {
    if (!this.titleRef) {
      return
    }

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
            textLength = 10
          }
          select(this.titleRef).attr('textLength', textLength)
        }
        // --------------------------------------------------------------------------------------------

        // ------------------------- Title will fit, but needs to be shifted down ---------------------
        const yTitleBBoxAfterTextLength = this.titleRef.getBBox()
        const yTitleTop =
          -1 * (yTitleBBoxAfterTextLength.x + yTitleBBoxAfterTextLength.width) +
          this.props.deltaY -
          this.AXIS_TITLE_BORDER_PADDING_LEFT

        if (yTitleTop < 0) {
          const overflow = -yTitleTop
          select(this.titleRef).attr('transform', `rotate(-90) translate(${-overflow}, 0)`)
        }
        // --------------------------------------------------------------------------------------------
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
        <LoadMoreDropdown {...this.props} style={{ ...this.labelInlineStyles, fontSize: '13px' }} />
      </g>
    )
  }

  shouldRenderAxisSelector = () => {
    return this.props.scale?.hasDropdown
  }

  shouldRenderAxisScaler = () => {
    return !!this.labelBBox && this.props.scale?.type === 'LINEAR' && this.props.scale?.domain().length !== 1
  }

  renderAxisScaler = () => {
    if (!this.shouldRenderAxisScaler()) {
      return null
    }

    return (
      <AxisScaler
        toggleChartScale={this.props.toggleChartScale}
        labelBBox={this.labelBBox}
        childProps={{
          ref: (r) => (this.axisScaler = r),
        }}
      />
    )
  }

  render = () => {
    return (
      <g
        data-test='axis'
        ref={(r) => (this.ref = r)}
        transform={`translate(${this.props.translateX}, ${this.props.translateY})`}
        style={this.labelInlineStyles}
      >
        <g className={`axis axis-${this.props.orient}`} ref={(el) => (this.axisElement = el)} />
        {this.renderAxisTitle()}
        {this.renderLoadMoreDropdown()}
        {this.renderAxisScaler()}
      </g>
    )
  }
}
