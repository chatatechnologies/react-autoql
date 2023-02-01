import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import { scaleOrdinal } from 'd3-scale'
import { select } from 'd3-selection'

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

import { svgToPng, getBBoxFromRef, sortDataByDate, getCurrencySymbol, deepEqual, difference } from '../../../js/Util.js'
import {
  chartContainerDefaultProps,
  chartContainerPropTypes,
  dataStructureChanged,
  getLegendLabelsForMultiSeries,
  getLegendLocation,
  mergeBboxes,
  onlySeriesVisibilityChanged,
} from '../helpers.js'

import { getColumnTypeAmounts } from '../../QueryOutput/columnHelpers'
import { getChartColorVars, getThemeValue } from '../../../theme/configureTheme'
import { AGG_TYPES, COLUMN_TYPES } from '../../../js/Constants'
import { aggregateData } from './aggregate'

import './ChataChart.scss'

export default class ChataChart extends Component {
  constructor(props) {
    super(props)
    const data = this.getData(props)
    const chartColors = getChartColorVars()

    this.PADDING = 20
    this.FONT_SIZE = 12

    this.firstRender = true
    this.colorScale = scaleOrdinal().range(chartColors)

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
    // The first render is to determine the chart size based on its parent container
    this.firstRender = false
    if (!this.props.isResizing) {
      this.forceUpdate()
    }

    if (!this.props.isResizing) {
      this.rebuildTooltips()
    }
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (nextProps.isResizing && this.props.isResizing) {
      return false
    }

    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isResizing && prevProps.isResizing) {
      if (this.chartContainerRef) {
        this.chartContainerRef.style.flexBasis = '100vh'
      }
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
    }

    if (
      (!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
      (prevProps.type && this.props.type !== prevProps.type)
    ) {
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true })
      this.rebuildTooltips()
    }

    if (dataStructureChanged(this.props, prevProps)) {
      const data = this.getData(this.props)
      this.setState({ data, chartID: uuid(), deltaX: 0, deltaY: 0, isLoading: true }, () => {
        this.rebuildTooltips()
      })
      return true
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.rebuildTooltipsTimer)
    clearTimeout(this.adjustVerticalPositionTimeout)
  }

  getData = (props) => {
    if (props.isAggregation) {
      return sortDataByDate(props.data, props.columns, 'reverse')
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
    clearTimeout(this.adjustVerticalPositionTimeout)
    this.adjustVerticalPositionTimeout = setTimeout(() => {
      const { deltaY } = this.getDeltas()
      const { innerHeight } = this.getInnerDimensions()
      this.setState({ deltaY, innerHeight }, () => {
        this.setFinishedLoading()
      })
    }, 0)
  }

  adjustChartPosition = () => {
    clearTimeout(this.adjustPositionTimeout)
    this.adjustPositionTimeout = setTimeout(() => {
      const { deltaX, deltaY } = this.getDeltas()
      const { innerHeight, innerWidth } = this.getInnerDimensions()
      this.setState({ deltaX, deltaY, innerHeight, innerWidth }, () => {
        this.setFinishedLoading()
      })
    }, 0)
  }

  getDeltas = () => {
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

    const containerWidth = this.props.width ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = this.props.height ?? this.chartContainerRef?.clientHeight ?? 0

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
      if (this.props.type === 'bar' || this.props.type === 'stacked_bar') {
        innerHeight -= this.FONT_SIZE
      }
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
    const containerWidth = this.props.width ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = this.props.height ?? this.chartContainerRef?.clientHeight ?? 0

    const outerWidth = Math.ceil(containerWidth)
    const outerHeight = Math.ceil(containerHeight)
    const outerX = this.chartContainerRef?.x ?? 0
    const outerY = this.chartContainerRef?.y ?? 0

    return { outerHeight, outerWidth, outerX, outerY }
  }

  getChartDimensions = () => {
    const containerWidth = this.props.width ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = this.props.height ?? this.chartContainerRef?.clientHeight ?? 0

    const { innerHeight, innerWidth } = this.getInnerDimensions()

    const outerWidth = Math.ceil(containerWidth)
    const outerHeight = Math.ceil(containerHeight)

    return {
      outerHeight,
      outerWidth,
      innerHeight: innerHeight ?? outerHeight,
      innerWidth: innerWidth ?? outerWidth,
    }
  }

  getLegendLabels = () => {
    return getLegendLabelsForMultiSeries(this.props.columns, this.colorScale, this.props.numberColumnIndices)
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

  getStringAxisTitle = () => {
    const { columns, stringColumnIndex } = this.props
    return columns?.[stringColumnIndex]?.display_name
  }

  getNumberAxisTitle = (columnIndices) => {
    const { columns } = this.props
    let title = ''
    let unit = ''

    try {
      const numberColumns = columns.filter((col, i) => {
        return columnIndices?.includes(i)
      })

      if (!numberColumns?.length) {
        return undefined
      }

      // If there are different titles for any of the columns, return a generic label based on the type
      const allTitlesEqual = !numberColumns.find((col) => {
        return col.display_name !== numberColumns[0].display_name
      })

      const columnType = numberColumns?.[0]?.type

      if (allTitlesEqual) {
        title = numberColumns?.[0]?.display_name
      } else {
        if (columnType === COLUMN_TYPES.CURRENCY) {
          title = 'Amount'
        } else if (columnType === COLUMN_TYPES.QUANTITY) {
          title = 'Quantity'
        } else if (columnType === COLUMN_TYPES.RATIO) {
          title = 'Ratio'
        }
      }

      if (columnType === COLUMN_TYPES.CURRENCY) {
        unit = getCurrencySymbol(this.props.dataFormatting) ?? ''
      }

      const aggTypes = numberColumns.map((col) => col.aggType)
      const allAggTypesSame = aggTypes.every((aggType) => aggType === aggTypes[0])

      let aggTypeDisplayName = ''
      if (allAggTypesSame) {
        aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === numberColumns[0].aggType)?.displayName ?? ''
      }

      let fullTitle = title
      if (unit || aggTypeDisplayName) {
        const spacer = !!unit && !!aggTypeDisplayName ? ' ' : ''
        fullTitle = `${title} (${aggTypeDisplayName}${spacer}${unit})`
      }

      return fullTitle
    } catch (error) {
      console.error(error)
      return title
    }
  }

  getCommonChartProps = () => {
    const { deltaX, deltaY } = this.state
    const { numberColumnIndices, numberColumnIndices2, columns, enableDynamicCharting } = this.props

    const { amountOfNumberColumns, amountOfStringColumns } = getColumnTypeAmounts(columns)
    const hasMultipleNumberColumns = amountOfNumberColumns > 1
    const hasMultipleStringColumns = amountOfStringColumns > 1

    const visibleSeriesIndices = numberColumnIndices.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const visibleSeriesIndices2 = numberColumnIndices2?.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const { innerHeight, innerWidth } = this.getInnerDimensions()

    return {
      ...this.props,
      setIsLoadingMoreRows: (isLoading) => this.setState({ isLoadingMoreRows: isLoading }),
      ref: (r) => (this.innerChartRef = r),
      innerChartRef: this.innerChartRef?.chartRef,
      key: undefined,
      data: this.state.data || this.props.data,
      colorScale: this.colorScale,
      height: innerHeight,
      width: innerWidth,
      deltaX,
      deltaY,
      chartPadding: this.PADDING,
      hasMultipleNumberColumns,
      hasMultipleStringColumns,
      hasStringDropdown: enableDynamicCharting && hasMultipleStringColumns,
      hasNumberDropdown: enableDynamicCharting && hasMultipleNumberColumns,
      marginAdjustmentFinished: true,
      legendTitle: this.props.legendColumn?.title || 'Category',
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendLabels: this.getLegendLabels(),
      onLabelRotation: this.adjustVerticalPosition,
      visibleSeriesIndices,
      visibleSeriesIndices2,
      numberAxisTitle: this.getNumberAxisTitle(visibleSeriesIndices),
      numberAxisTitle2: this.getNumberAxisTitle(visibleSeriesIndices2),
      stringAxisTitle: this.getStringAxisTitle(),
      onStringColumnSelect: this.onStringColumnSelect,
      tooltipID: this.props.tooltipID,
      chartTooltipID: this.props.chartTooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement || this.chartContainerRef,
      totalRowCount: this.props.totalRowCount,
      chartID: this.state.chartID,
      changeNumberColumnIndices: this.changeNumberColumnIndices,
      rebuildTooltips: this.rebuildTooltips,
      onAxesRenderComplete: this.adjustChartPosition,
    }
  }

  renderChartLoader = () => {
    return (
      <div className='chart-loader chart-page-loader'>
        <Spinner />
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
    const { outerHeight, outerWidth } = this.getOuterDimensions()

    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color-secondary')

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-chart-${this.state.chartID}`}
          key={`react-autoql-chart-${this.state.chartID}`}
          ref={(r) => (this.chartContainerRef = r)}
          data-test='react-autoql-chart'
          className={`react-autoql-chart-container ${this.state.isLoading || this.props.isResizing ? 'loading' : ''}`}
          style={{
            flexBasis: outerHeight ? `${outerHeight}px` : '100vh',
            pointerEvents: this.state.isLoadingMoreRows ? 'none' : 'unset',
          }}
        >
          {!this.firstRender && !this.props.isResizing && !this.props.isAnimating && (
            <Fragment>
              {this.state.isLoadingMoreRows && this.renderChartLoader()}
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns='http://www.w3.org/2000/svg'
                width={outerWidth}
                height={outerHeight}
                style={{
                  fontFamily: chartFontFamily,
                  color: chartTextColor,
                  background: chartBackgroundColor,
                }}
              >
                <g className='react-autoql-chart-content-container'>{this.renderChart()}</g>
              </svg>
            </Fragment>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
