import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import _isEqual from 'lodash.isequal'
import _sortBy from 'lodash.sortby'
import _cloneDeep from 'lodash.clonedeep'
import _isEmpty from 'lodash.isempty'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { sum, mean, count, deviation, variance, median, min, max } from 'd3-array'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'
import { ChataStackedBarChart } from '../ChataStackedBarChart'
import { ChataStackedColumnChart } from '../ChataStackedColumnChart'
import { ChataStackedLineChart } from '../ChataStackedLineChart'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { svgToPng, sortDataByDate, formatChartLabel, onlyUnique, getBBoxFromRef } from '../../../js/Util.js'
import {
  chartContainerDefaultProps,
  chartContainerPropTypes,
  dataStructureChanged,
  getLegendLabelsForMultiSeries,
  getLegendLocation,
} from '../helpers.js'
import './ChataChart.scss'
import { getColumnTypeAmounts, isColumnDateType } from '../../QueryOutput/columnHelpers'
import { getChartColorVars, getThemeValue } from '../../../theme/configureTheme'
import { Spinner } from '../../Spinner'
import { AGG_TYPES } from '../../../js/Constants'

const defaultAggType = 'sum'

export default class ChataChart extends Component {
  constructor(props) {
    super(props)
    const chartColors = getChartColorVars()

    this.PADDING = 5
    this.INNER_PADDING = 0.25
    this.OUTER_PADDING = 0.5
    this.LEGEND_PADDING = 10
    this.AXIS_LABEL_PADDING = 30
    this.DEFAULT_BOTTOM_MARGIN = 100

    this.firstRender = true
    this.recursiveUpdateCount = 0
    this.previousAggType = undefined

    this.colorScale = scaleOrdinal().range(chartColors)

    const aggregatedData = this.aggregateRowData(props)

    this.state = {
      chartID: uuid(),
      aggregatedData,
      rightAxisMargin: 0,
      bottomAxisMargin: 0,
      rightLegendMargin: 0,
      bottomLegendMargin: 0,
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

    // this.setDeltas()
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
    if (
      (!this.props.isResizing && prevProps.isResizing) ||
      (!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) ||
      this.props.type !== prevProps.type
    ) {
      this.rebuildTooltips()
    }

    if (dataStructureChanged(this.props, prevProps)) {
      const aggregatedData = this.aggregateRowData(this.props)
      this.setState({ aggregatedData }, () => {
        this.rebuildTooltips()
      })
    }
  }

  onAxesRenderComplete = () => {
    this.setDeltas()
  }

  setDeltas = () => {
    this.setState({ deltaX: 0, deltaY: 0, isLoading: true }, () => {
      setTimeout(() => {
        // Get distance in px to shift to the right
        const axesBBoxX = Math.ceil(getBBoxFromRef(this.innerChartRef.chartRef)?.x ?? 0)
        const deltaX = -1 * axesBBoxX + this.PADDING

        // Get distance in px to shift down
        const axesBBoxY = Math.ceil(getBBoxFromRef(this.innerChartRef.chartRef)?.y ?? 0)
        const deltaY = -1 * axesBBoxY + this.PADDING

        const rightAxisMargin =
          Math.ceil(getBBoxFromRef(this.innerChartRef?.axesRef?.rightAxis)?.width ?? 0) + this.PADDING

        const bottomAxisMargin =
          Math.ceil(getBBoxFromRef(this.innerChartRef?.axesRef?.bottomAxis?.ref)?.height ?? 0) + this.PADDING

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

  aggregateFn = (dataset, aggType) => {
    const aggregateType = aggType || this.state?.aggType
    switch (aggregateType) {
      case 'avg': {
        return mean(dataset)
      }
      case 'median': {
        return median(dataset)
      }
      case 'min': {
        return min(dataset)
      }
      case 'max': {
        return max(dataset)
      }
      case 'deviation': {
        return deviation(dataset)
      }
      case 'variance': {
        return variance(dataset)
      }
      case 'count': {
        return count(dataset)
      }
      case 'count-distinct': {
        const uniqueDataset = dataset.filter(onlyUnique)
        return count(uniqueDataset)
      }
      default: {
        // SUM by default
        return sum(dataset)
      }
    }
  }

  addValuesToAggDataset = (props, datasetsToAggregate, currentRow) => {
    const { numberColumnIndices, columns } = props
    numberColumnIndices.forEach((columnIndex) => {
      const column = columns[columnIndex]
      if (column.visible) {
        const value = Number(currentRow[columnIndex])
        if (datasetsToAggregate[columnIndex]) {
          datasetsToAggregate[columnIndex].push(value)
        } else {
          datasetsToAggregate[columnIndex] = [value]
        }
      }
    })
  }

  aggregateRowData = (props) => {
    const { stringColumnIndex, data, columns } = props
    const stringColumn = columns[stringColumnIndex]
    let sortedData

    if (data?.length === 1) {
      return data
    }

    if (isColumnDateType(stringColumn)) {
      sortedData = sortDataByDate(data, columns, 'chart')
    } else {
      sortedData = _sortBy(props.data, (row) => row?.[stringColumnIndex])
    }

    if (props.isPivot) {
      return sortedData
    }

    const aggregatedData = []

    let prevRow
    let datasetsToAggregate = {}
    sortedData.forEach((currentRow, i) => {
      const isLastRow = i === sortedData.length - 1

      let currentLabel
      if (currentRow) {
        currentLabel =
          formatChartLabel({
            d: currentRow[stringColumnIndex],
            col: stringColumn,
            config: this.props.dataFormatting,
          })?.fullWidthLabel ?? currentRow[stringColumnIndex]
      }

      let prevLabel
      if (prevRow) {
        prevLabel =
          formatChartLabel({
            d: prevRow[stringColumnIndex],
            col: stringColumn,
            config: this.props.dataFormatting,
          })?.fullWidthLabel ?? prevRow[stringColumnIndex]
      }

      const labelChanged = currentLabel && prevLabel && currentLabel !== prevLabel

      if (!labelChanged || isLastRow) {
        this.addValuesToAggDataset(props, datasetsToAggregate, currentRow)
      }

      if (labelChanged || isLastRow) {
        // Category changed, finish aggregation and add row to dataset
        if (Object.keys(datasetsToAggregate)?.length) {
          const newRow = _cloneDeep(prevRow)
          Object.keys(datasetsToAggregate).forEach((columnIndex) => {
            const aggregateType = columns[columnIndex].aggType || defaultAggType
            newRow[columnIndex] = this.aggregateFn(datasetsToAggregate[columnIndex], aggregateType)
          })

          aggregatedData.push(newRow)

          datasetsToAggregate = {}
          this.addValuesToAggDataset(props, datasetsToAggregate, currentRow)
        } else {
          aggregatedData.push(currentRow)
        }
      }

      prevRow = currentRow
    })

    return aggregatedData
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

  changeNumberColumnIndices = (indices, newColumns) => {
    this.props.changeNumberColumnIndices(indices, newColumns)
    this.setState({ chartID: uuid() })
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

    try {
      const numberColumns = columns.filter((col, i) => {
        return columnIndices.includes(i)
      })

      if (!numberColumns?.length) {
        return undefined
      }

      // If there are different titles for any of the columns, return a generic label based on the type
      const allTitlesEqual = !numberColumns.find((col) => {
        title = col.display_name !== numberColumns[0].display_name
      })

      if (allTitlesEqual) {
        title = numberColumns?.[0]?.display_name
      }

      const columnType = numberColumns?.[0]?.type
      if (columnType === 'DOLLAR_AMT') {
        title = 'Amount'
      } else if (columnType === 'QUANTITY') {
        title = 'Quantity'
      } else if (columnType === 'RATIO') {
        title = 'Ratio'
      } else if (columnType === 'PERCENT') {
        title = 'Percent'
      }

      const aggTypes = numberColumns.map((col) => col.aggType)
      const allAggTypesSame = aggTypes.every((aggType) => aggType === aggTypes[0])

      if (allAggTypesSame) {
        const aggTypeDisplayName = AGG_TYPES.find((agg) => agg.value === numberColumns[0].aggType)?.displayName
        if (aggTypeDisplayName) {
          title = `${title} (${aggTypeDisplayName})`
        }
      }
    } catch (error) {
      console.error(error)
    }

    return title
  }

  getCommonChartProps = () => {
    const { rightLegendMargin, bottomLegendMargin, deltaX, deltaY, rightAxisMargin, bottomAxisMargin } = this.state
    const { numberColumnIndices, numberColumnIndices2, columns, enableDynamicCharting } = this.props

    let innerPadding = this.INNER_PADDING
    if (numberColumnIndices.length > 1 || numberColumnIndices2 > 1) {
      innerPadding = 0.1
    }

    const { amountOfNumberColumns, amountOfStringColumns } = getColumnTypeAmounts(columns)
    const hasMultipleNumberColumns = amountOfNumberColumns > 1
    const hasMultipleStringColumns = amountOfStringColumns > 1

    const visibleSeriesIndices = numberColumnIndices.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const visibleSeriesIndices2 = numberColumnIndices2.filter(
      (colIndex) => columns?.[colIndex] && !columns[colIndex].isSeriesHidden,
    )

    const { innerHeight, innerWidth } = this.getChartDimensions()

    return {
      ...this.props,
      setIsLoadingMoreRows: (isLoading) => this.setState({ isLoadingMoreRows: isLoading }),
      ref: (r) => (this.innerChartRef = r),
      key: `chata-inner-chart-${this.state.chartID}`,
      data: this.state.aggregatedData || this.props.data,
      colorScale: this.colorScale,
      innerPadding,
      outerPadding: this.OUTER_PADDING,
      colorScale: this.colorScale,
      height: innerHeight,
      width: innerWidth,
      rightLegendMargin,
      bottomLegendMargin,
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
      // onLabelChange: this.setDeltas,
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
      totalRowsNumber: this.props.totalRowsNumber,
      isChartScaled: this.state.isChartScaled,
      chartID: this.state.chartID,
      setIsChartScaled: this.setIsChartScaled,
      changeNumberColumnIndices: this.changeNumberColumnIndices,
      rebuildTooltips: this.rebuildTooltips,
      onAxesRenderComplete: this.onAxesRenderComplete,
    }
  }

  moveIndexToFront = (index, array) => {
    const newArray = _cloneDeep(array)
    const itemToRemove = array[index]
    newArray.slice(index, index + 1)
    newArray.unshift(itemToRemove)
    return newArray
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
