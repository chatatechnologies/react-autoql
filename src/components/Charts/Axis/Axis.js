import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import { select } from 'd3-selection'
import { axisLeft, axisBottom, axisTop, axisRight } from 'd3-axis'
import { isMobile } from 'react-device-detect'
import {
  formatChartLabel,
  getBBoxFromRef,
  mergeBoundingClientRects,
  shouldLabelsRotate,
  DisplayTypes,
  ColumnTypes,
  DateStringPrecisionTypes,
  PrecisionTypes,
} from 'autoql-fe-utils'

import safeGetBBox from '../../../utils/safeGetBBox'

import { Legend } from '../Legend'
import AxisScaler from './AxisScaler'
import AxisSelector from '../Axes/AxisSelector'
import AxisSortPopover from '../Axes/AxisSortPopover'

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
      isAxisSortOpen: false,
    }
  }

  static propTypes = {
    ...chartPropTypes,
    scale: PropTypes.func,
    orient: PropTypes.string,
    translateX: PropTypes.number,
    translateY: PropTypes.number,
    axisSorts: PropTypes.object,
    onAxisSortChange: PropTypes.func,
    columnOverrides: PropTypes.object,
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
    axisSorts: {},
    onAxisSortChange: () => {},
  }

  // Convenience getters to avoid repeating prop-based checks
  get isHeatmapOrBubble() {
    return this.props.type === DisplayTypes.HEATMAP || this.props.type === DisplayTypes.BUBBLE
  }

  get isYAxis() {
    return this.props.scale?.axis === 'y'
  }

  get isHeatmapOrBubbleYAxis() {
    return this.isHeatmapOrBubble && this.isYAxis
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
    if (!this.state.isAxisSelectorOpen && !this.state.isAxisSortOpen) {
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

      const legendBBox = safeGetBBox(this.legendContainer)
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
      const axisBBox = safeGetBBox(this.axisElement)
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
    this.adjustAxisSortBorder()
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

  openSortPopover = () => {
    this.setState({ isAxisSortOpen: true })
  }

  closeSortPopover = () => {
    this.setState({ isAxisSortOpen: false })
  }

  shouldRenderAxisSort = () => {
    // Only show sort for ordinal (BAND) type axes
    if (this.props.scale?.type !== 'BAND') {
      return false
    }

    // Don't allow Y-axis sorting for heatmaps and bubble charts
    if (this.isHeatmapOrBubbleYAxis) {
      return false
    }

    return true
  }

  renderAxisSort = ({ positions }) => {
    if (!this.shouldRenderAxisSort()) {
      return null
    }

    // Get the column index for this axis
    const columnIndex = this.props.scale?.column?.index
    const axis = this.props.scale?.axis || 'x' // 'x' or 'y'

    // Always use originalColumns for display names to avoid duplicates from pivoted columns
    let column = null
    let valueColumn = null
    let columnDisplayName = this.props.scale?.title || 'column'
    let valueColumnDisplayName = 'values'

    // Always try to find column by name in originalColumns (works for both aggregated and non-aggregated)
    const columnName = this.props.scale?.column?.name
    if (columnName && this.props.originalColumns) {
      column = this.props.originalColumns.find((col) => col.name === columnName)
      if (column) {
        columnDisplayName = column.display_name || columnDisplayName
      }

      // Get value column display name (first number column from originalColumns)
      const numberColumnIndices = this.props.numberColumnIndices || []
      const primaryNumberColumnIndex = numberColumnIndices[0]
      if (primaryNumberColumnIndex !== undefined) {
        valueColumn = this.props.originalColumns[primaryNumberColumnIndex]
        if (valueColumn) {
          valueColumnDisplayName = valueColumn.display_name || valueColumnDisplayName
        }
      }
    } else {
      // Fallback to using props.columns if originalColumns not available or no column name
      column = this.props.columns?.[columnIndex]
      columnDisplayName = column?.display_name || columnDisplayName

      // Get value column display name (first number column)
      const numberColumnIndices = this.props.numberColumnIndices || []
      const primaryNumberColumnIndex = numberColumnIndices[0]
      if (primaryNumberColumnIndex !== undefined) {
        valueColumn = this.props.columns?.[primaryNumberColumnIndex]
        if (valueColumn) {
          valueColumnDisplayName = valueColumn.display_name || valueColumnDisplayName
        }
      }
    }

    // Get current sort state for this axis
    const axisSortKey = `${axis}-${columnIndex}`
    const currentSort = this.props.axisSorts?.[axisSortKey] || null

    // Create handler that wraps onAxisSortChange
    const handleSortChange = (sortType) => {
      if (this.props.onAxisSortChange && columnIndex !== undefined) {
        this.props.onAxisSortChange(axis, columnIndex, sortType)
      }
    }

    // For heatmaps, bubble charts, and pivot data, only allow string column sorting (no value sorting)
    const stringColumnOnly = this.isHeatmapOrBubble || this.props.isAggregated

    return (
      <AxisSortPopover
        chartContainerRef={this.props.chartContainerRef}
        popoverParentElement={this.props.popoverParentElement}
        hidden={!this.shouldRenderAxisSort()}
        currentSort={currentSort}
        onSortChange={handleSortChange}
        columnDisplayName={columnDisplayName}
        valueColumnDisplayName={valueColumnDisplayName}
        align='center'
        position='right'
        positions={positions}
        axisSortRef={(r) => (this.axisSort = r)}
        isOpen={this.state.isAxisSortOpen}
        closeSelector={this.closeSortPopover}
        stringColumnOnly={stringColumnOnly}
      >
        <g>
          <rect
            ref={(r) => (this.axisSort = r)}
            className={`axis-label-border ${this.shouldRenderAxisSort() ? '' : 'hidden'}`}
            data-test='axis-sort-border'
            onClick={this.openSortPopover}
            fill='transparent'
            stroke='transparent'
            strokeWidth='1px'
            rx='4'
          />
          <text
            className='axis-sort-icon'
            data-test='axis-sort-icon'
            fontSize='14px'
            fill='currentColor'
            stroke='currentColor'
            strokeWidth='0.5px'
            paintOrder='stroke'
            textAnchor='middle'
            dominantBaseline='middle'
            opacity='0' // use css to style so it isnt exported in the png
            style={{ cursor: 'pointer' }}
            onClick={this.openSortPopover}
          >
            ⇅
          </text>
        </g>
      </AxisSortPopover>
    )
  }

  adjustAxisSortBorder = () => {
    if (!this.titleRef || !this.axisSort || !this.shouldRenderAxisSort()) {
      return
    }

    const titleBBox = safeGetBBox(this.titleRef)
    const titleHeight = titleBBox?.height ?? 0
    const titleWidth = titleBBox?.width ?? 0
    const titleX = titleBBox?.x ?? 0
    const titleY = titleBBox?.y ?? 0

    // Position to the right of the title/selector with some spacing
    const SORT_BUTTON_WIDTH = 20
    const SORT_BUTTON_SPACING = 5

    // Find the sort icon text element (it's a sibling of the rect)
    const sortGroup = this.axisSort?.parentElement
    const sortIcon = sortGroup?.querySelector('.axis-sort-icon')

    const transform = this.titleRef?.getAttribute('transform')
    const isRotated = transform?.includes('rotate')

    // Get axis selector position for reference
    const selectorBBox = this.axisSelector ? getBBoxFromRef(this.axisSelector) : null

    let rectX, rectY, rectWidth, rectHeight, iconX, iconY, iconTransform

    if (isRotated) {
      // For rotated axes (left/right), position next to the selector
      // Use selector's actual bounding box if available, otherwise calculate from title
      let selectorX, selectorY, selectorWidth, selectorHeight

      if (selectorBBox) {
        selectorX = selectorBBox.x
        selectorY = selectorBBox.y
        selectorWidth = selectorBBox.width
        selectorHeight = selectorBBox.height
      } else {
        selectorWidth = titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
        selectorX = titleX - this.AXIS_TITLE_BORDER_PADDING_LEFT
        selectorY = titleY - this.AXIS_TITLE_BORDER_PADDING_TOP
        selectorHeight = titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP
      }

      // For rotated -90, the selector appears vertically in final rendering
      // "After the text" means positioned after the selector end
      // Position button after the selector (to the right in rotated space = higher X value)
      rectWidth = Math.round(selectorHeight) // Match selector height
      rectHeight = SORT_BUTTON_WIDTH
      // Position after selector: selectorX + selectorWidth + spacing
      rectX = Math.round(selectorX + selectorWidth + SORT_BUTTON_SPACING)
      // Align vertically with selector center
      rectY = Math.round(selectorY + selectorHeight / 2 - SORT_BUTTON_WIDTH / 2)
      iconX = rectX + rectWidth / 2
      iconY = rectY + rectHeight / 2 + 2
      // Apply same transform as title, then rotate icon 90 degrees so arrows point correctly
      iconTransform = transform ? `${transform} rotate(90)` : 'rotate(90)'
    } else {
      // For horizontal axes (bottom/top), position to the right of the title/selector
      const selectorWidth = titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT
      const selectorX = titleX - this.AXIS_TITLE_BORDER_PADDING_LEFT

      rectWidth = SORT_BUTTON_WIDTH
      rectHeight = Math.round(titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP)
      rectX = Math.round(selectorX + selectorWidth + SORT_BUTTON_SPACING)
      rectY = Math.round(titleY - this.AXIS_TITLE_BORDER_PADDING_TOP)
      iconX = rectX + rectWidth / 2
      iconY = rectY + rectHeight / 2 + 2
      iconTransform = transform || null
    }

    select(this.axisSort)
      .attr('transform', transform || null)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('x', rectX)
      .attr('y', rectY)

    if (sortIcon) {
      select(sortIcon).attr('transform', iconTransform).attr('x', iconX).attr('y', iconY)
    }
  }

  renderAxisSelector = ({ positions, isSecondAxis, childProps = {} }) => {
    const columnsForSelector = this.props.isAggregated ? this.props.originalColumns : this.props.columns

    // For heatmap/bubble Y-axis, use legend (pivot) handler instead of string handler
    const changeStringColumnIndexHandler = this.isHeatmapOrBubbleYAxis
      ? this.props.changeLegendColumnIndex
      : this.props.changeStringColumnIndex

    return (
      <AxisSelector
        chartContainerRef={this.props.chartContainerRef}
        changeNumberColumnIndices={this.props.changeNumberColumnIndices}
        changeStringColumnIndex={changeStringColumnIndexHandler}
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
        enableCyclicalDates={this.props.enableCyclicalDates}
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

  getPrecisionLabel = (override) => {
    if (!override) return null

    const { type, precision } = override

    // Map precision values to labels (matching StringAxisSelector dateBucketOptions)
    const precisionLabelMap = {
      [PrecisionTypes.YEAR]: 'Year',
      [PrecisionTypes.QUARTER]: 'Quarter',
      [PrecisionTypes.MONTH]: 'Month',
      [PrecisionTypes.WEEK]: 'Week',
      [PrecisionTypes.DAY]: 'Day',
      [PrecisionTypes.DATE_HOUR]: 'Hour',
      [PrecisionTypes.DATE_MINUTE]: 'Minute',
      [PrecisionTypes.DATE_SECOND]: 'Second',
      [DateStringPrecisionTypes.QUARTERONLY]: 'Quarter of Year',
      [DateStringPrecisionTypes.MONTHONLY]: 'Month of Year',
      [DateStringPrecisionTypes.WEEKONLY]: 'Week of Year',
      [DateStringPrecisionTypes.DOM]: 'Day of Month',
      [DateStringPrecisionTypes.DOW]: 'Day of Week',
      [DateStringPrecisionTypes.HOUR]: 'Hour of Day',
    }

    return precisionLabelMap[precision] || null
  }

  getPrecisionLabel = (override) => {
    if (!override) return null

    const { type, precision } = override

    // Map precision values to labels (matching StringAxisSelector dateBucketOptions)
    const precisionLabelMap = {
      [PrecisionTypes.YEAR]: 'Year',
      [PrecisionTypes.QUARTER]: 'Quarter',
      [PrecisionTypes.MONTH]: 'Month',
      [PrecisionTypes.WEEK]: 'Week',
      [PrecisionTypes.DAY]: 'Day',
      [PrecisionTypes.DATE_HOUR]: 'Hour',
      [PrecisionTypes.DATE_MINUTE]: 'Minute',
      [PrecisionTypes.DATE_SECOND]: 'Second',
      [DateStringPrecisionTypes.QUARTERONLY]: 'Quarter of Year',
      [DateStringPrecisionTypes.MONTHONLY]: 'Month of Year',
      [DateStringPrecisionTypes.WEEKONLY]: 'Week of Year',
      [DateStringPrecisionTypes.DOM]: 'Day of Month',
      [DateStringPrecisionTypes.DOW]: 'Day of Week',
      [DateStringPrecisionTypes.HOUR]: 'Hour of Day',
    }

    return precisionLabelMap[precision] || null
  }

  renderAxisTitleText = () => {
    const { scale, columnOverrides, originalColumns } = this.props
    const { scale, columnOverrides, originalColumns } = this.props
    const title = scale?.title ?? ''

    // Check if there's a column override for this axis
    // For pivot tables, scale.column.index might be 0, so we need to find the original column by name
    let override = null
    const columnIndex = scale?.column?.index
    const columnName = scale?.column?.name

    if (columnOverrides && (columnIndex !== undefined || columnName)) {
      // First try to find override by column index
      if (columnIndex !== undefined) {
        override = columnOverrides[columnIndex]
      }

      // If not found and we have a column name, try to find the original column and use its index
      if (!override && columnName && originalColumns) {
        const originalColumn = originalColumns.find((col) => col.name === columnName)
        if (originalColumn?.index !== undefined) {
          override = columnOverrides[originalColumn.index]
        }
      }
    }

    const precisionLabel = this.getPrecisionLabel(override)

    // Append precision label in brackets if override exists
    const displayTitle = precisionLabel ? `${title} (${precisionLabel})` : title

    if (displayTitle.length > 35) {
      return (
        <tspan data-tooltip-content={displayTitle} data-tooltip-id={this.props.chartTooltipID} data-test='axis-label'>
          {`${displayTitle.substring(0, 35)}...`}
        <tspan data-tooltip-content={displayTitle} data-tooltip-id={this.props.chartTooltipID} data-test='axis-label'>
          {`${displayTitle.substring(0, 35)}...`}
        </tspan>
      )
    }

    return (
      <tspan data-test='axis-label'>
        <tspan ref={(r) => (this.titleText = r)}>{displayTitle}</tspan>
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
        {this.renderAxisSort({
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
        {this.renderAxisSort({
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
        {this.renderAxisSort({
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
        {this.renderAxisSort({
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

      const xTitleBBox = safeGetBBox(this.titleRef)

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
      const xTitleBBoxAfterTextLength = safeGetBBox(this.titleRef)
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
      const yTitleBBox = safeGetBBox(this.titleRef)

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
      const yTitleBBoxAfterTextLength = safeGetBBox(this.titleRef)
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

  // TODO/PROPOSAL: Move selector visibility logic to `autoql-fe-utils` as `shouldRenderAxisSelector(scale, isAggregated, legendLocation, columns)` and add `scale.shouldRenderAxisSelector`.
  shouldRenderAxisSelector = () => {
    // Don't render a Y-axis selector for heatmaps or bubble charts —
    // the chart uses a legend/pivot selection instead and the X-axis
    // already provides a selector. This simplifies the UI.
    if (this.isHeatmapOrBubbleYAxis) {
      return false
    }
    const { scale, isAggregated, legendLocation, originalColumns, columns } = this.props
    const scaleType = scale?.type
    const isStringAxis = scaleType === 'BAND' || scaleType === 'TIME'

    // For numeric (LINEAR) axes
    if (!isStringAxis) {
      return scale?.allFields?.length > 1 || scale?.hasDropdown
    }

    // For string axes, show selector if aggregated with legend or multiple groupable columns
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
