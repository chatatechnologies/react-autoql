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
import { Spinner } from '../../Spinner'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { svgToPng, getBBoxFromRef, sortDataByDate, getCurrencySymbol } from '../../../js/Util.js'
import {
  chartContainerDefaultProps,
  chartContainerPropTypes,
  dataStructureChanged,
  getLegendLabelsForMultiSeries,
  getLegendLocation,
  mergeBboxes,
} from '../helpers.js'
import { getColumnTypeAmounts } from '../../QueryOutput/columnHelpers'
import { getChartColorVars, getThemeValue } from '../../../theme/configureTheme'
import { AGG_TYPES, COLUMN_TYPES } from '../../../js/Constants'
import { aggregateData } from './aggregate'

import './ChataChart.scss'

export default class ChataChart extends Component {
  constructor(props) {
    super(props)
    const chartColors = getChartColorVars()

    this.PADDING = 6
    this.LEGEND_PADDING = 50
    this.AXIS_LABEL_PADDING = 30
    this.DEFAULT_BOTTOM_MARGIN = 100

    this.firstRender = true
    this.recursiveUpdateCount = 0
    this.previousAggType = undefined

    this.colorScale = scaleOrdinal().range(chartColors)

    const data = this.getData(props)

    this.state = {
      chartID: uuid(),
      data,
      rightAxisMargin: 0,
      bottomAxisMargin: 0,
      deltaX: 0,
      deltaY: 0,
      // isLoading: true,
      isLoadingMoreRows: false,
      isChartScaled: false,
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

    if (this.state.isLoading && nextState.isLoading) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps) => {
    let shouldForceUpdate = false

    if (
      (!this.props.isResizing && prevProps.isResizing) ||
      (!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
      this.props.type !== prevProps.type
    ) {
      this.setState({ chartID: uuid(), deltaX: 0, deltaY: 0, bottomAxisMargin: 0, rightAxisMargin: 0 })
      this.rebuildTooltips()
    }

    if (!this.props.isResizing && prevProps.isResizing) {
      // Fill max message container after resize
      if (this.chartContainerRef) {
        this.chartContainerRef.style.flexBasis = '100vh'
        shouldForceUpdate = true
      }
    }

    if (dataStructureChanged(this.props, prevProps)) {
      const data = this.getData(this.props)
      this.setState({ data, chartID: uuid(), deltaX: 0, deltaY: 0, bottomAxisMargin: 0, rightAxisMargin: 0 }, () => {
        this.rebuildTooltips()
      })
      return
    }

    if (shouldForceUpdate) {
      this.forceUpdate()
    }
  }

  getData = (props) => {
    if (props.isPivot) {
      return sortDataByDate(props.data, props.columns, 'chart')
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

  onAxesRenderComplete = () => {
    this.adjustChartPosition()
  }

  adjustChartPosition = () => {
    this.setState({ deltaX: 0, deltaY: 0, isLoading: true }, () => {
      setTimeout(() => {
        const axesBBox = getBBoxFromRef(this.innerChartRef?.chartRef)

        // Get distance in px to shift to the right
        const axesBBoxX = Math.ceil(axesBBox?.x ?? 0)
        const deltaX = -1 * axesBBoxX + this.PADDING

        const deltaY =
          -1 * Math.ceil(getBBoxFromRef(this.innerChartRef?.axesRef?.topAxis?.ref)?.height ?? 0) + this.PADDING

        // Get height difference in px to determine proper chart height
        const leftAxisBBox = this.innerChartRef?.axesRef?.leftAxis?.ref?.getBoundingClientRect()
        const bottomAxisBBox = this.innerChartRef?.axesRef?.bottomAxis?.ref?.getBoundingClientRect()
        const leftBottomBBox = mergeBboxes([leftAxisBBox, bottomAxisBBox])
        const leftBottomHeight = leftBottomBBox?.height ?? containerHeight
        const containerHeight = this.props.height ?? this.chartContainerRef?.clientHeight ?? 0
        let bottomAxisMargin = Math.ceil(leftBottomHeight - containerHeight + this.PADDING)
        if (bottomAxisMargin < 0) {
          bottomAxisMargin = 0
        }

        let rightAxisMargin =
          Math.ceil(getBBoxFromRef(this.innerChartRef?.axesRef?.rightAxis)?.width ?? 0) + this.PADDING

        // const hasLegend = !!getLegendLocation(this.props.numberColumnIndices, this.props.type)
        // if (hasLegend) {
        //   rightAxisMargin += this.LEGEND_PADDING
        // }

        this.setState({ deltaX, deltaY, rightAxisMargin, bottomAxisMargin }, () => {
          this.setState({ isLoading: false })
        })
      }, 0)
    })
  }

  getChartDimensions = () => {
    const { rightAxisMargin, bottomAxisMargin, deltaX, deltaY } = this.state

    const containerWidth = this.props.width ?? this.chartContainerRef?.clientWidth ?? 0
    const containerHeight = this.props.height ?? this.chartContainerRef?.clientHeight ?? 0

    let innerWidth = Math.floor(containerWidth - rightAxisMargin - deltaX)
    if (innerWidth < 0) {
      innerWidth = 0
    }

    let innerHeight = Math.floor(containerHeight - bottomAxisMargin - deltaY)
    if (innerHeight < 0) {
      innerHeight = 0
    }

    const outerWidth = Math.ceil(containerWidth)
    const outerHeight = Math.ceil(containerHeight)

    return { outerHeight, outerWidth, innerHeight, innerWidth }
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

  setIsChartScaled = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  clearLoading = () => {
    clearTimeout(this.loadingTimeout)
    this.loadingTimeout = setTimeout(() => {
      this.setState({ isLoading: false })
    }, 100)
  }

  changeNumberColumnIndices = (indices, indices2, newColumns) => {
    this.props.changeNumberColumnIndices(indices, indices2, newColumns)
    // this.setState({ chartID: uuid() })
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
        aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === numberColumns[0].aggType)?.displayName
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
    const { deltaX, deltaY, rightAxisMargin, bottomAxisMargin } = this.state
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

    const { innerHeight, innerWidth } = this.getChartDimensions()

    return {
      ...this.props,
      setIsLoadingMoreRows: (isLoading) => this.setState({ isLoadingMoreRows: isLoading }),
      ref: (r) => (this.innerChartRef = r),
      // key: `chata-inner-chart-${this.state.chartID}`,
      key: undefined,
      data: this.state.data || this.props.data,
      colorScale: this.colorScale,
      colorScale: this.colorScale,
      height: innerHeight,
      width: innerWidth,
      deltaX,
      deltaY,
      rightAxisMargin,
      bottomAxisMargin,
      hasMultipleNumberColumns,
      hasMultipleStringColumns,
      hasStringDropdown: enableDynamicCharting && hasMultipleStringColumns,
      hasNumberDropdown: enableDynamicCharting && hasMultipleNumberColumns,
      marginAdjustmentFinished: true,
      legendTitle: this.props.legendColumn?.title || 'Category',
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendLabels: this.getLegendLabels(),
      // onLabelChange: this.adjustChartPosition,
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
      isChartScaled: this.state.isChartScaled,
      chartID: this.state.chartID,
      setIsChartScaled: this.setIsChartScaled,
      changeNumberColumnIndices: this.changeNumberColumnIndices,
      rebuildTooltips: this.rebuildTooltips,
      onAxesRenderComplete: this.onAxesRenderComplete,
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
      default: {
        return 'Unknown Display Type'
      }
    }
  }

  render = () => {
    const { outerHeight, outerWidth } = this.getChartDimensions()

    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color')

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
          {!this.firstRender && !this.props.isResizing && (
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
