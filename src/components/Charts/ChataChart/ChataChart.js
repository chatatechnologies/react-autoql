import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { scaleOrdinal } from 'd3-scale'
import { isMobile } from 'react-device-detect'
import {
  aggregateData,
  getLegendLabelsForMultiSeries,
  svgToPng,
  getBBoxFromRef,
  sortDataByDate,
  deepEqual,
  rotateArray,
  onlyUnique,
  DATE_ONLY_CHART_TYPES,
  DOUBLE_AXIS_CHART_TYPES,
  CHARTS_WITHOUT_AGGREGATED_DATA,
  getDateColumnIndex,
  isColumnDateType,
  getChartColorVars,
  getThemeValue,
  dataStructureChanged,
  getLegendLocation,
  mergeBoundingClientRects,
} from 'autoql-fe-utils'

import { ErrorBoundary } from '../../../containers/ErrorHOC'
import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'
import { ChataStackedBarChart } from '../ChataStackedBarChart'
import { ChataStackedColumnChart } from '../ChataStackedColumnChart'
import { ChataStackedLineChart } from '../ChataStackedLineChart'
import { ChataScatterplotChart } from '../ChataScatterplotChart'
import { ChataColumnLineChart } from '../ChataColumnLine'
import { ChataHistogram } from '../ChataHistogram'
import { Spinner } from '../../Spinner'

import { chartContainerDefaultProps, chartContainerPropTypes } from '../chartPropHelpers.js'

import './ChataChart.scss'
import { CSS_PREFIX } from '../../../js/Constants'

export default class ChataChart extends React.Component {
  constructor(props) {
    super(props)
    const data = this.getData(props)

    this.PADDING = 0
    this.FONT_SIZE = 12
    this.HISTOGRAM_SLIDER_KEY = uuid()

    this.firstRender = true
    this.bucketSize = props.bucketSize
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

    type: PropTypes.string.isRequired,
    onBucketSizeChange: PropTypes.func,
  }

  static defaultProps = {
    ...chartContainerDefaultProps,
    onBucketSizeChange: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
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

    if (this.props.dataChangeCount !== nextProps.dataChangeCount) {
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
    if (!this._isMounted) {
      return
    }

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
      this._isMounted &&
      ((!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
        (prevProps.type && this.props.type !== prevProps.type))
    ) {
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    if (dataStructureChanged(this.props, prevProps) || this.props.dataChangeCount !== prevProps.dataChangeCount) {
      const data = this.getData(this.props)
      this.setState({ data, chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
    clearTimeout(this.adjustVerticalPositionTimeout)
  }

  getColorScales = () => {
    const { numberColumnIndices, numberColumnIndices2 } = this.props
    const { chartColors, chartColorsDark } = getChartColorVars()

    const numSeries = numberColumnIndices?.length ?? 1
    const chartColors2 = rotateArray(chartColorsDark, -1 * numSeries)

    const colorScale = scaleOrdinal().range(chartColors).domain(numberColumnIndices)
    let colorScale2
    if (numberColumnIndices2?.length) {
      colorScale2 = scaleOrdinal().range(chartColors2).domain(numberColumnIndices2)
    }

    return { colorScale, colorScale2 }
  }

  getData = (props) => {
    if (!props.data?.length || !props.columns?.length) {
      return
    }

    if (props.isDataAggregated) {
      return sortDataByDate(props.data, props.columns, 'asc')
    } else {
      const indices1 = props.numberColumnIndices ?? []
      const indices2 = props.numberColumnIndices2 ?? []
      const numberIndices = [...indices1, ...indices2].filter(onlyUnique)

      if (!numberIndices.length) {
        return
      }

      return aggregateData({
        data: props.data,
        aggColIndex: props.stringColumnIndex,
        columns: props.columns,
        numberIndices,
        dataFormatting: props.dataFormatting,
      })
    }
  }

  setFinishedLoading = () => {
    clearTimeout(this.loadingTimeout)
    this.loadingTimeout = setTimeout(() => {
      if (this._isMounted) {
        this.setState({ isLoading: false })
      }
    }, 0)
  }

  adjustVerticalPosition = () => {
    // Adjust bottom and top axes second time to account for label rotation
    // Debounce in case multiple axes have rotated labels, we only want to
    // do the adjustment once
    if (!this.props.hidden) {
      clearTimeout(this.adjustVerticalPositionTimeout)
      this.adjustVerticalPositionTimeout = setTimeout(() => {
        if (this._isMounted) {
          const { deltaY } = this.getDeltas()
          const { innerHeight } = this.getInnerDimensions()
          this.setState({ deltaY, innerHeight }, () => {
            this.setFinishedLoading()
          })
        }
      }, 0)
    }
  }

  adjustChartPosition = () => {
    if (!this.props.hidden) {
      clearTimeout(this.adjustPositionTimeout)
      this.adjustPositionTimeout = setTimeout(() => {
        if (this._isMounted) {
          const { deltaX, deltaY } = this.getDeltas()
          const { innerHeight, innerWidth } = this.getInnerDimensions()
          this.setState({ deltaX, deltaY, innerHeight, innerWidth }, () => {
            this.adjustVerticalPosition()
          })
        }
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
    const topAxisBBox = this.innerChartRef?.axesRef?.topAxis?.ref?.getBoundingClientRect()
    const bottomAxisBBox = this.innerChartRef?.axesRef?.bottomAxis?.getBoundingClientRect()
    const rightAxisBBox = this.innerChartRef?.axesRef?.rightAxis?.getBoundingClientRect()
    const clippedLegendBBox = this.innerChartRef?.axesRef?.legendRef?.legendClippingContainer?.getBoundingClientRect()
    const axesBBox = mergeBoundingClientRects([
      leftAxisBBox,
      bottomAxisBBox,
      rightAxisBBox,
      topAxisBBox,
      clippedLegendBBox,
    ])

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

  getBase64Data = (scale) => {
    if (!this.chartRef) {
      return Promise.reject()
    }

    return svgToPng(this.chartRef, scale, CSS_PREFIX)
  }

  saveAsPNG = (scale) => {
    try {
      this.getBase64Data(scale).then((data) => {
        const a = document.createElement('a')
        a.download = 'Chart.png'
        a.href = data
        a.click()
      })
    } catch (error) {
      console.error(error)
      return
    }
  }

  setIsLoadingMoreRows = (isLoading) => {
    if (this._isMounted) {
      this.setState({ isLoadingMoreRows: isLoading })
    }
  }

  onBucketSizeChange = (bucketSize) => {
    this.props.onBucketSizeChange(bucketSize)
    this.bucketSize = bucketSize
  }

  renderChartHeader = () => {
    let paddingLeft = this.state.deltaX - 10
    if (isMobile || paddingLeft < 0 || this.outerWidth < 300) {
      paddingLeft = 25
    }

    return (
      <div
        ref={(r) => (this.sliderRef = r)}
        style={{ paddingLeft }}
        className={`react-autoql-chart-header-container ${
          this.state.isLoading || this.props.isResizing ? 'loading' : ''
        }`}
      />
    )
  }

  getCommonChartProps = () => {
    const { deltaX, deltaY } = this.state
    const { numberColumnIndices, columns, enableDynamicCharting } = this.props

    const visibleSeriesIndices = numberColumnIndices.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const { innerHeight, innerWidth } = this.getInnerDimensions()
    const { outerHeight, outerWidth } = this.getOuterDimensions()
    const { colorScale, colorScale2 } = this.getColorScales()

    const aggregated = !CHARTS_WITHOUT_AGGREGATED_DATA.includes(this.props.type)
    const data = (aggregated ? this.state.data : null) || this.props.data

    return {
      ...this.props,
      columns,
      setIsLoadingMoreRows: this.setIsLoadingMoreRows,
      ref: (r) => (this.innerChartRef = r),
      innerChartRef: this.innerChartRef?.chartRef,
      key: undefined,
      data,
      aggregated,
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
      enableAxisDropdown: enableDynamicCharting && !this.props.isAggregated,
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type, this.props.legendLocation),
      onLabelRotation: this.adjustVerticalPosition,
      visibleSeriesIndices,
      tooltipID: this.props.tooltipID,
      chartTooltipID: this.props.chartTooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement,
      totalRowCount: this.props.totalRowCount,
      chartID: this.state.chartID,
      isLoading: this.state.isLoading,
      changeNumberColumnIndices: this.props.changeNumberColumnIndices,
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

  renderChart = () => {
    const commonChartProps = this.getCommonChartProps()

    switch (this.props.type) {
      case 'column': {
        return <ChataColumnChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'bar': {
        return <ChataBarChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'line': {
        return <ChataLineChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'pie': {
        return <ChataPieChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'bubble': {
        return <ChataBubbleChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'heatmap': {
        return <ChataHeatmapChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'stacked_column': {
        return <ChataStackedColumnChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'stacked_bar': {
        return <ChataStackedBarChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'stacked_line': {
        return <ChataStackedLineChart {...commonChartProps} legendLabels={this.getLegendLabels()} />
      }
      case 'column_line': {
        const visibleSeriesIndices2 = this.props.numberColumnIndices2?.filter(
          (i) => this.props.columns?.[i] && !this.props.columns[i].isSeriesHidden,
        )

        return (
          <ChataColumnLineChart
            {...commonChartProps}
            visibleSeriesIndices2={visibleSeriesIndices2}
            legendLabels={this.getLegendLabels()}
          />
        )
      }
      case 'histogram': {
        return (
          <ChataHistogram
            {...commonChartProps}
            initialBucketSize={this.bucketSize}
            onBucketSizeChange={this.onBucketSizeChange}
            portalRef={this.sliderRef}
          />
        )
      }
      case 'scatterplot': {
        return <ChataScatterplotChart {...commonChartProps} />
      }
      default: {
        return 'Unknown Display Type'
      }
    }
  }

  render = () => {
    if (!this.state.data?.length) {
      return null
    }

    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color-secondary')

    return (
      <ErrorBoundary>
        <>
          {this.renderChartHeader()}
          <div
            id={`react-autoql-chart-${this.state.chartID}`}
            key={`react-autoql-chart-${this.state.chartID}`}
            ref={(r) => (this.chartContainerRef = r)}
            data-test='react-autoql-chart'
            className={`react-autoql-chart-container
            ${this.state.isLoading || this.props.isResizing ? 'loading' : ''}
            ${this.state.isLoadingMoreRows ? 'loading-rows' : ''}
            ${this.props.hidden ? 'hidden' : ''}`}
          >
            {!this.firstRender && !this.props.isResizing && !this.props.isAnimating && (
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns='http://www.w3.org/2000/svg'
                width='100%'
                height='100%'
                style={{
                  fontSize: '12px',
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
            )}
            {this.state.isLoadingMoreRows && this.renderChartLoader()}
          </div>
        </>
      </ErrorBoundary>
    )
  }
}
