import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import { scaleOrdinal } from 'd3-scale'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'
import { ChataStackedBarChart } from '../ChataStackedBarChart'
import { ChataStackedColumnChart } from '../ChataStackedColumnChart'
import { ChataStackedLineChart } from '../ChataStackedLineChart'
import { ChataColumnLineChart } from '../ChataColumnLine'
import { Spinner } from '../../Spinner'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { svgToPng, getBBoxFromRef, sortDataByDate, deepEqual, rotateArray } from '../../../js/Util.js'

import {
  chartContainerDefaultProps,
  chartContainerPropTypes,
  dataStructureChanged,
  getLegendLabelsForMultiSeries,
  getLegendLocation,
  mergeBboxes,
} from '../helpers.js'

import { getDateColumnIndex, isColumnDateType } from '../../QueryOutput/columnHelpers'
import { getChartColorVars, getThemeValue } from '../../../theme/configureTheme'
import { aggregateData } from './aggregate'
import { DATE_ONLY_CHART_TYPES, DOUBLE_AXIS_CHART_TYPES } from '../../../js/Constants'

import './ChataChart.scss'

export default class ChataChart extends Component {
  constructor(props) {
    super(props)
    const data = this.getData(props)

    this.PADDING = 10
    this.FONT_SIZE = 12

    this.firstRender = true
    this.shouldRecalculateDimensions = false

    this.state = {
      chartID: uuid(),
      data,
      deltaX: 0,
      deltaY: 0,
      isLoading: true,
      isLoadingMoreRows: false,
    }
  }

  DEFAULT_MARGINS = {
    left: 50,
    right: 10,
    bottom: 100,
    top: 10,
  }

  static propTypes = {
    ...chartContainerPropTypes,
    rebuildTooltips: PropTypes.func,
    type: PropTypes.string.isRequired,
  }

  static defaultProps = chartContainerDefaultProps

  componentDidMount = () => {
    if (!this.props.isResizing && !this.props.hidden) {
      // The first render is to determine the chart size based on its parent container
      this.firstRender = false
      this.forceUpdate()
    }
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.props.isResizing && !nextProps.isResizing) {
      this.shouldRecalculateDimensions = true
      return true
    }

    if ((nextProps.isResizing && this.props.isResizing) || (nextProps.hidden && this.props.hidden)) {
      return false
    }

    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps) => {
    if (this.firstRender === true && !this.props.hidden) {
      this.firstRender = false
    }

    if (this.props.hidden && !prevProps.hidden) {
      this.firstRender = true
    }

    if (
      (!this.props.isResizing && prevProps.isResizing && !this.props.hidden) ||
      (!this.props.hidden && prevProps.hidden)
    ) {
      if (this.chartContainerRef) {
        this.chartContainerRef.style.flexBasis = '100vh'
      }
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    if (
      this.props.type !== prevProps.type &&
      DATE_ONLY_CHART_TYPES.includes(this.props.type) &&
      !isColumnDateType(this.props.columns[this.props.stringColumnIndex])
    ) {
      const dateColumnIndex = getDateColumnIndex(this.props.columns)
      this.props.changeStringColumnIndex(dateColumnIndex)
    } else if (this.props.type !== prevProps.type && DOUBLE_AXIS_CHART_TYPES.includes(this.props.type)) {
      const indicesIntersection = this.props.numberColumnIndices.filter((index) =>
        this.props.numberColumnIndices2.includes(index),
      )
      const indicesIntersect = !!indicesIntersection?.length
      if (indicesIntersect) {
        console.debug('Selected columns already exist on the other axis. Exiting')
        const newNumberColumnIndices = this.props.numberColumnIndices.filter(
          (index) => !this.props.numberColumnIndices2.includes(index),
        )
        this.props.changeNumberColumnIndices(newNumberColumnIndices, this.props.numberColumnIndices2)
      }
    }

    if (
      (!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
      (prevProps.type && this.props.type !== prevProps.type)
    ) {
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    if (dataStructureChanged(this.props, prevProps)) {
      const data = this.getData(this.props)
      this.setState({ data, chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
      return true
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.rebuildTooltipsTimer)
    clearTimeout(this.adjustVerticalPositionTimeout)
  }

  getColorScales = () => {
    const { chartColors, chartColorsDark } = getChartColorVars()
    const numSeries = this.props.numberColumnIndices?.length ?? 1
    const colorScale = scaleOrdinal().range(chartColors)
    const colorScale2 = scaleOrdinal().range(rotateArray(chartColorsDark, -1 * numSeries))
    return { colorScale, colorScale2 }
  }

  getData = (props) => {
    if (props.isDataAggregated) {
      return sortDataByDate(props.data, props.columns, 'asc')
    } else {
      return aggregateData({
        data: props.data,
        aggIndex: props.stringColumnIndex,
        columns: props.columns,
        numberIndices: props.numberColumnIndices,
        dataFormatting: props.dataFormatting,
      })
    }
  }

  setFinishedLoading = () => {
    clearTimeout(this.loadingTimeout)
    this.loadingTimeout = setTimeout(() => {
      this.setState({ isLoading: false })
    }, 0)
  }

  adjustVerticalPosition = () => {
    // Adjust bottom and top axes second time to account for label rotation
    // Debounce in case multiple axes have rotated labels, we only want to
    // do the adjustment once
    if (!this.props.hidden) {
      clearTimeout(this.adjustVerticalPositionTimeout)
      this.adjustVerticalPositionTimeout = setTimeout(() => {
        const { deltaY } = this.getDeltas()
        const { innerHeight } = this.getInnerDimensions()
        this.setState({ deltaY, innerHeight }, () => {
          this.setFinishedLoading()
        })
      }, 0)
    }
  }

  adjustChartPosition = () => {
    if (!this.props.hidden) {
      clearTimeout(this.adjustPositionTimeout)
      this.adjustPositionTimeout = setTimeout(() => {
        const { deltaX, deltaY } = this.getDeltas()
        const { innerHeight, innerWidth } = this.getInnerDimensions()
        this.setState({ deltaX, deltaY, innerHeight, innerWidth }, () => {
          this.adjustVerticalPosition()
        })
      }, 0)
    }
  }

  getDeltas = () => {
    if (this.props.type === 'pie') {
      return { deltaX: 0, deltaY: 0 }
    }

    const axesBBox = getBBoxFromRef(this.innerChartRef?.chartRef)

    // Get distance in px to shift to the right
    const axesBBoxX = Math.ceil(axesBBox?.x ?? 0)
    const deltaX = -1 * axesBBoxX + this.PADDING

    // Get distance in px to shift down
    const axesBBoxY = Math.ceil(axesBBox?.y ?? 0)
    const deltaY = -1 * axesBBoxY + this.PADDING

    return { deltaX, deltaY }
  }

  getRenderedChartDimensions = () => {
    const leftAxisBBox = this.innerChartRef?.axesRef?.leftAxis?.ref?.getBoundingClientRect()
    const bottomAxisBBox = this.innerChartRef?.axesRef?.bottomAxis?.ref?.getBoundingClientRect()
    const rightAxisBBox = this.innerChartRef?.axesRef?.rightAxis?.ref?.getBoundingClientRect()
    const topAxisBBox = this.innerChartRef?.axesRef?.topAxis?.ref?.getBoundingClientRect()
    const clippedLegendBBox = this.innerChartRef?.axesRef?.legendRef?.legendClippingContainer?.getBoundingClientRect()
    const axesBBox = mergeBboxes([leftAxisBBox, bottomAxisBBox, rightAxisBBox, topAxisBBox, clippedLegendBBox])

    const axesWidth = axesBBox?.width ?? 0
    const axesHeight = axesBBox?.height ?? 0
    const axesX = axesBBox?.x ?? 0
    const axesY = axesBBox?.y ?? 0

    return {
      chartHeight: axesHeight,
      chartWidth: axesWidth,
      chartX: axesX,
      chartY: axesY,
    }
  }

  getInnerDimensions = () => {
    const { chartWidth, chartHeight } = this.getRenderedChartDimensions()

    const propsWidth = typeof this.props.width === 'number' ? this.props.width : undefined
    const propsHeight = typeof this.props.height === 'number' ? this.props.height : undefined

    const containerWidth = propsWidth ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = propsHeight ?? this.chartContainerRef?.clientHeight ?? 0

    let innerWidth = containerWidth - 2 * this.PADDING
    if (this.innerChartRef?.xScale && chartWidth) {
      const rangeInPx = this.innerChartRef.xScale.range()[1] - this.innerChartRef.xScale.range()[0]
      const totalHorizontalMargins = chartWidth - rangeInPx
      innerWidth = containerWidth - totalHorizontalMargins - 2 * this.PADDING
    }

    let innerHeight = containerHeight - 2 * this.PADDING
    if (this.innerChartRef?.yScale && chartHeight) {
      const rangeInPx = this.innerChartRef.yScale.range()[0] - this.innerChartRef.yScale.range()[1]
      const totalVerticalMargins = chartHeight - rangeInPx
      innerHeight = containerHeight - totalVerticalMargins - 2 * this.PADDING
    }

    if (innerWidth < 1) {
      innerWidth = 1
    }

    if (innerHeight < 1) {
      innerHeight = 1
    }

    return { innerWidth, innerHeight }
  }

  getOuterDimensions = () => {
    const defaultDimensions = {
      outerHeight: this.outerHeight,
      outerWidth: this.outerWidth,
    }

    if (this.props.hidden || this.props.isAnimating || this.firstRender) {
      return defaultDimensions
    }

    if (!this.outerWidth || !this.outerHeight || this.shouldRecalculateDimensions) {
      this.shouldRecalculateDimensions = false

      const containerBBox = this.chartContainerRef?.getBoundingClientRect()
      const containerWidth = containerBBox?.width ?? 0
      const containerHeight = containerBBox?.height ?? 0

      const outerWidth = Math.ceil(containerWidth)
      const outerHeight = Math.ceil(containerHeight)

      this.outerWidth = outerWidth
      this.outerHeight = outerHeight

      return { outerHeight, outerWidth }
    }

    return defaultDimensions
  }

  getLegendLabels = () => {
    return getLegendLabelsForMultiSeries(
      this.props.columns,
      this.getColorScales()?.colorScale,
      this.props.numberColumnIndices,
    )
  }

  rebuildTooltips = (delay = 500) => {
    if (this.props.rebuildTooltips) {
      this.props.rebuildTooltips(delay)
    } else {
      clearTimeout(this.rebuildTooltipsTimer)
      this.rebuildTooltipsTimer = setTimeout(() => {
        ReactTooltip.rebuild()
      }, delay)
    }
  }

  changeNumberColumnIndices = (indices, indices2, newColumns) => {
    this.props.changeNumberColumnIndices(indices, indices2, newColumns)
  }

  getBase64Data = () => {
    const svgElement = this.chartRef
    if (!svgElement) {
      return Promise.reject()
    }
    return svgToPng(svgElement, 20)
      .then((data) => Promise.resolve(data))
      .catch(() => Promise.reject())
  }

  saveAsPNG = () => {
    const svgElement = this.chartRef
    if (!svgElement) {
      return
    }

    svgToPng(svgElement, 20)
      .then((data) => {
        let dt = data // << this fails in IE/Edge...
        dt = dt.replace(/^data:image\/[^;]*/, 'data:application/octet-stream')
        dt = dt.replace(
          /^data:application\/octet-stream/,
          'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Canvas.png',
        )

        // Create link and simulate click for download
        const link = document.createElement('a')
        link.setAttribute('href', dt)
        link.setAttribute('download', 'Chart.png')
        link.setAttribute('target', '_blank')
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
      })
      .catch((error) => {
        console.error(error)
      })
  }

  getCommonChartProps = () => {
    const { deltaX, deltaY } = this.state
    const { numberColumnIndices, numberColumnIndices2, columns, enableDynamicCharting } = this.props

    const visibleSeriesIndices = numberColumnIndices.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const visibleSeriesIndices2 = numberColumnIndices2?.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const { innerHeight, innerWidth } = this.getInnerDimensions()
    const { outerHeight, outerWidth } = this.getOuterDimensions()
    const { colorScale, colorScale2 } = this.getColorScales()

    return {
      ...this.props,
      setIsLoadingMoreRows: (isLoading) => this.setState({ isLoadingMoreRows: isLoading }),
      ref: (r) => (this.innerChartRef = r),
      innerChartRef: this.innerChartRef?.chartRef,
      key: undefined,
      data: this.state.data || this.props.data,
      disableTimeScale: this.disableTimeScale,
      colorScale,
      colorScale2,
      height: innerHeight,
      width: innerWidth,
      outerHeight,
      outerWidth,
      deltaX,
      deltaY,
      chartPadding: this.PADDING,
      enableAxisDropdown: enableDynamicCharting && !this.props.isPivot,
      marginAdjustmentFinished: true,
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendLabels: this.getLegendLabels(),
      onLabelRotation: this.adjustVerticalPosition,
      visibleSeriesIndices,
      visibleSeriesIndices2,
      tooltipID: this.props.tooltipID,
      chartTooltipID: this.props.chartTooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement,
      totalRowCount: this.props.totalRowCount,
      chartID: this.state.chartID,
      changeNumberColumnIndices: this.changeNumberColumnIndices,
      rebuildTooltips: this.rebuildTooltips,
      onAxesRenderComplete: this.adjustChartPosition,
    }
  }

  renderChartLoader = () => {
    return (
      <div className='table-loader table-page-loader'>
        <div className='page-loader-spinner'>
          <Spinner />
        </div>
      </div>
    )
  }

  renderColumnChart = () => <ChataColumnChart {...this.getCommonChartProps()} />
  renderBarChart = () => <ChataBarChart {...this.getCommonChartProps()} />
  renderLineChart = () => <ChataLineChart {...this.getCommonChartProps()} />
  renderPieChart = () => <ChataPieChart {...this.getCommonChartProps()} />
  renderHeatmapChart = () => <ChataHeatmapChart {...this.getCommonChartProps()} />
  renderBubbleChart = () => <ChataBubbleChart {...this.getCommonChartProps()} />
  renderStackedColumnChart = () => <ChataStackedColumnChart {...this.getCommonChartProps()} />
  renderStackedBarChart = () => <ChataStackedBarChart {...this.getCommonChartProps()} />
  renderStackedLineChart = () => <ChataStackedLineChart {...this.getCommonChartProps()} />
  renderColumnLineChart = () => <ChataColumnLineChart {...this.getCommonChartProps()} />

  renderChart = () => {
    switch (this.props.type) {
      case 'column': {
        return this.renderColumnChart()
      }
      case 'bar': {
        return this.renderBarChart()
      }
      case 'line': {
        return this.renderLineChart()
      }
      case 'pie': {
        return this.renderPieChart()
      }
      case 'bubble': {
        return this.renderBubbleChart()
      }
      case 'heatmap': {
        return this.renderHeatmapChart()
      }
      case 'stacked_column': {
        return this.renderStackedColumnChart()
      }
      case 'stacked_bar': {
        return this.renderStackedBarChart()
      }
      case 'stacked_line': {
        return this.renderStackedLineChart()
      }
      case 'column_line': {
        return this.renderColumnLineChart()
      }
      default: {
        return 'Unknown Display Type'
      }
    }
  }

  render = () => {
    // const { outerHeight } = this.getOuterDimensions()
    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color-secondary')

    const style = {}
    // if (!this.props.hidden) {
    //   style.flexBasis = outerHeight ? `${outerHeight}px` : '100vh'
    // }

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-chart-${this.state.chartID}`}
          key={`react-autoql-chart-${this.state.chartID}`}
          ref={(r) => (this.chartContainerRef = r)}
          data-test='react-autoql-chart'
          className={`react-autoql-chart-container
            ${this.state.isLoading || this.props.isResizing ? 'loading' : ''}
            ${this.state.isLoadingMoreRows ? 'loading-rows' : ''}
            ${this.props.hidden ? 'hidden' : ''}`}
          style={style}
        >
          {!this.firstRender && !this.props.isResizing && !this.props.isAnimating && (
            <Fragment>
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns='http://www.w3.org/2000/svg'
                width='100%'
                height='100%'
                style={{
                  fontFamily: chartFontFamily,
                  color: chartTextColor,
                  background: chartBackgroundColor,
                }}
              >
                <g
                  transform={`translate(${this.state.deltaX}, ${this.state.deltaY})`}
                  className='react-autoql-chart-content-container'
                >
                  {this.renderChart()}
                </g>
              </svg>
            </Fragment>
          )}
          {this.state.isLoadingMoreRows && this.renderChartLoader()}
        </div>
      </ErrorBoundary>
    )
  }
}
