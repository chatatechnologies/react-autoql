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
import { svgToPng, sortDataByDate, formatChartLabel, onlyUnique } from '../../../js/Util.js'
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

    this.CHART_ID = uuid()
    this.PADDING = 20
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
      aggregatedData,
      leftMargin: this.PADDING,
      rightMargin: this.PADDING,
      topMargin: this.PADDING,
      bottomMargin: this.PADDING,
      rightLegendMargin: 0,
      bottomLegendMargin: 0,
      loading: true,
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

  componentDidUpdate = (prevProps, prevState) => {
    const newState = {}
    let shouldForceUpdate = false
    let shouldUpdateMargins = false

    const { chartHeight, chartWidth } = this.getChartDimensions()

    if (
      !this.state.isLoading &&
      this.recursiveUpdateCount < 2 &&
      (chartWidth !== this.chartWidth || chartHeight !== this.chartHeight)
    ) {
      shouldForceUpdate = true
      this.recursiveUpdateCount++
      clearTimeout(this.recursiveUpdateTimeout)
      this.recursiveUpdateTimeout = setTimeout(() => {
        this.recursiveUpdateCount = 0
      }, 500)
    }

    this.chartHeight = chartHeight
    this.chartWidth = chartWidth

    if (!this.props.isResizing && prevProps.isResizing) {
      // Fill max message container after resize
      // No need to update margins, they should stay the same
      if (this.chartContainerRef) {
        this.chartContainerRef.style.flexBasis = '100vh'
        shouldForceUpdate = true
      }
      this.rebuildTooltips()
    }
    if (!this.props.isDrilldownChartHidden && prevProps.isDrilldownChartHidden) {
      this.rebuildTooltips()
    }

    if (this.props.type !== prevProps.type) {
      this.rebuildTooltips()
    }

    if (dataStructureChanged(this.props, prevProps)) {
      shouldUpdateMargins = true
      const aggregatedData = this.aggregateRowData(this.props)
      newState.aggregatedData = aggregatedData
      this.rebuildTooltips()
    }

    // --------- Only update state once after checking new props -----------
    // ----------- keep this at the bottom of componentDidMount ------------
    if (!_isEmpty(newState)) {
      shouldForceUpdate = false
      this.setState(newState, () => {
        if (shouldUpdateMargins) {
          this.updateMargins()
        }
      })
      return
    } else if (shouldUpdateMargins) {
      this.updateMargins()
      return
    }
    if (this.props.data !== prevProps.data) {
      shouldForceUpdate = true
    }
    if (shouldForceUpdate) {
      this.forceUpdate()
    }
  }

  componentWillUnmount = () => {
    clearTimeout(this.recursiveUpdateTimeout)

    if (this.getNewMargins) {
      this.getNewMargins.cancel()
    }

    this.legend = undefined
    this.xAxis = undefined
    this.axes = undefined
  }

  getChartDimensions = () => {
    const { topMargin, bottomMargin, rightMargin, leftMargin, rightLegendMargin, bottomLegendMargin } = this.state

    let chartWidth = this.props.width ?? this.chartContainerRef?.clientWidth
    if (chartWidth < 0) {
      chartWidth = 0
    }

    let chartHeight = this.props.height ?? this.chartContainerRef?.clientHeight
    if (chartHeight < 0) {
      chartHeight = 0
    }

    let innerHeight = chartHeight - bottomMargin - topMargin - bottomLegendMargin - this.AXIS_LABEL_PADDING
    if (innerHeight < 0) {
      innerHeight = 0
    }

    let innerWidth = chartWidth - leftMargin - rightMargin - rightLegendMargin - this.AXIS_LABEL_PADDING
    if (innerWidth < 0) {
      innerWidth = 0
    }

    return { chartHeight, chartWidth, innerHeight, innerWidth }
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

  aggregateRowData = (props, aggType) => {
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

    // if (aggregateType !== this.previousAggType) {
    //   const newColumns = _cloneDeep(this.props.columns)
    //   this.props.numberColumnIndices.forEach((colIndex) => {
    //     newColumns[colIndex].aggType = aggregateType
    //   })

    //   this.props.updateColumns(newColumns)
    // }

    // this.previousAggType = aggregateType

    return aggregatedData
  }

  getNewLeftMargin = (chartContainerBbox, axesBbox) => {
    const containerLeft = chartContainerBbox.x
    const axesLeft = axesBbox.x + containerLeft
    let leftMargin = this.state.leftMargin

    leftMargin += containerLeft - axesLeft + this.AXIS_LABEL_PADDING
    return leftMargin
  }

  getNewRightMargin = (chartContainerBbox, axesBbox, leftMargin, rightLegendMargin) => {
    const axesLeft = axesBbox.x + chartContainerBbox.x
    const axesRight = axesLeft + axesBbox.width
    const containerRight = chartContainerBbox.x + chartContainerBbox.width - rightLegendMargin
    const rightDiff = axesRight + containerRight

    const leftMarginDiff = leftMargin - this.state.leftMargin
    const maxMargin = chartContainerBbox.width - leftMarginDiff - rightLegendMargin
    const calculatedMargin = rightDiff + this.AXIS_LABEL_PADDING + this.LEGEND_PADDING

    let rightMargin = this.state.rightMargin
    if (calculatedMargin < maxMargin) {
      rightMargin = calculatedMargin
    } else {
      rightMargin = this.PADDING
    }

    // if (rightLegendMargin && rightMargin - rightLegendMargin > 0) {
    //   rightMargin = rightMargin - rightLegendMargin
    // }

    return rightMargin
  }

  getNewRightLegendMargin = (legendBBox) => {
    let rightLegendMargin = 0
    const legendLocation = getLegendLocation(this.props.numberColumnIndices, this.props.type)
    if (legendLocation === 'right' && legendBBox?.width) {
      rightLegendMargin = legendBBox.width + this.LEGEND_PADDING
    }

    return rightLegendMargin
  }

  getLegendLabels = () => {
    return getLegendLabelsForMultiSeries(this.props.columns, this.colorScale, this.props.numberColumnIndices)
  }

  getNewBottomMargin = (chartContainerBbox, legendBBox) => {
    let bottomLegendMargin = 0
    const legendLocation = getLegendLocation(this.props.numberColumnIndices, this.props.type)
    if (legendLocation === 'bottom' && legendBBox?.height) {
      bottomLegendMargin = legendBBox.height + 10
    }

    this.xAxis = select(this.chartRef).select('.axis-Bottom').node()

    const xAxisBBox = this.xAxis ? this.xAxis.getBBox() : {}
    let bottomMargin = Math.ceil(xAxisBBox.height) + bottomLegendMargin + this.AXIS_LABEL_PADDING // margin to include axis label

    if (xAxisBBox.height === 0) {
      bottomMargin = this.DEFAULT_BOTTOM_MARGIN // if no xAxisBBox available, set bottomMargin to default
    }

    if (this.props.enableAjaxTableData) {
      bottomMargin = bottomMargin + this.AXIS_LABEL_PADDING // margin to include row count summary
    }

    // only for bar charts (vertical grid lines mess with the axis size)
    if (this.props.type === 'bar' || this.props.type === 'stacked_bar') {
      const innerTickSize = chartContainerBbox.height - this.state.topMargin - this.state.bottomMargin
      bottomMargin = bottomMargin - innerTickSize
    }

    return bottomMargin || this.state.bottomMargin
  }

  // If we can find a way to clip the legend, this will work
  // getNewBottomMargin = (chartContainerBbox, axesBbox) => {
  //   const axesTop = axesBbox.y + chartContainerBbox.y
  //   const axesBottom = axesTop + axesBbox.height
  //   const containerBottom =
  //     chartContainerBbox.y +
  //     chartContainerBbox.height -
  //     this.X_AXIS_LABEL_HEIGHT
  //   let bottomMargin = this.state.bottomMargin
  //   bottomMargin += axesBottom - containerBottom
  //   return bottomMargin
  // }

  // Keep this in case we need it later
  getNewTopMargin = () => {
    return this.PADDING
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

  updateMargins = ({ setLoading = true, delay = 100 } = {}) => {
    if (!this.state.isLoading && setLoading) {
      this.setState({ isLoading: true })
    }

    clearTimeout(this.updateMarginsDebounced)
    this.updateMarginsDebounced = setTimeout(() => {
      this.updateMarginsToDebounce()
    }, delay)
  }
  setIsChartScaled = () => {
    this.setState({ isChartScaled: !this.state.isChartScaled })
  }

  updateMarginsToDebounce = () => {
    this.newMargins = undefined

    try {
      this.axes = document.querySelector(`#react-autoql-chart-${this.CHART_ID} .react-autoql-axes`)

      if (!this.chartContainerRef || !this.axes) {
        this.clearLoading()
        return
      }

      const chartContainerBbox = this.chartContainerRef.getBoundingClientRect()
      const axesBbox = this.axes.getBBox()
      const legendBbox = select(this.chartRef)?.select('.legendOrdinal')?.node()?.getBBox()

      const rightLegendMargin = this.getNewRightLegendMargin(legendBbox)

      const leftMargin = this.getNewLeftMargin(chartContainerBbox, axesBbox)
      const rightMargin = this.getNewRightMargin(chartContainerBbox, axesBbox, leftMargin, rightLegendMargin)
      const topMargin = this.getNewTopMargin()
      const bottomMargin = this.getNewBottomMargin(chartContainerBbox, legendBbox)

      this.newMargins = {
        leftMargin,
        topMargin,
        rightMargin,
        bottomMargin,
        rightLegendMargin,
      }

      this.isMarginDiffSignificant = this.isMarginDifferenceSignificant()

      if (this.isMarginDiffSignificant) {
        this.marginAdjustmentFinished = true
        this.setState({ ...this.newMargins }, () => {
          this.clearLoading()
        })
      } else {
        this.marginAdjustmentFinished = true
        this.clearLoading()
      }
    } catch (error) {
      // Something went wrong rendering the chart.
      console.error(error)
      this.marginAdjustmentFinished = true
      this.clearLoading()
    }
  }

  clearLoading = () => {
    clearTimeout(this.loadingTimeout)
    this.loadingTimeout = setTimeout(() => {
      this.setState({ isLoading: false })
    }, 100)
  }

  isMarginDifferenceSignificant = () => {
    if (!this.newMargins) {
      return false
    }

    const { leftMargin, topMargin, rightLegendMargin, bottomMargin } = this.newMargins
    const leftDiff = Math.abs(leftMargin - this.state.leftMargin)
    const topDiff = Math.abs(topMargin - this.state.topMargin)
    const rightDiff = Math.abs(rightLegendMargin - this.state.rightLegendMargin)
    const bottomDiff = Math.abs(bottomMargin - this.state.bottomMargin)

    return leftDiff > 10 || topDiff > 10 || rightDiff > 10 || bottomDiff > 10
  }

  changeNumberColumnIndices = (indices, newColumns) => {
    this.props.changeNumberColumnIndices(indices, newColumns)
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

  getNumberAxisTitle = () => {
    const { columns, numberColumnIndices } = this.props
    let title = ''

    try {
      const numberColumns = columns.filter((col, i) => {
        return numberColumnIndices.includes(i)
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
    const { topMargin, bottomMargin, rightMargin, leftMargin, rightLegendMargin, bottomLegendMargin } = this.state
    const { numberColumnIndices, numberColumnIndices2, columns } = this.props

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

    const { chartHeight, chartWidth, innerHeight, innerWidth } = this.getChartDimensions()

    return {
      ...this.props,
      setIsLoadingMoreRows: (isLoading) => this.setState({ isLoadingMoreRows: isLoading }),
      key: undefined,
      data: this.state.aggregatedData || this.props.data,
      colorScale: this.colorScale,
      innerPadding,
      outerPadding: this.OUTER_PADDING,
      chartContainerPadding: this.PADDING,
      colorScale: this.colorScale,
      height: chartHeight,
      width: chartWidth,
      innerHeight,
      innerWidth: innerWidth,
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
      rightLegendMargin,
      bottomLegendMargin,
      hasMultipleNumberColumns,
      hasMultipleStringColumns,
      marginAdjustmentFinished: this.state.loading,
      legendTitle: this.props.legendColumn?.title || 'Category',
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendLabels: this.getLegendLabels(),
      // legendPadding: this.LEGEND_PADDING,
      visibleSeriesIndices,
      visibleSeriesIndices2,
      numberAxisTitle: this.getNumberAxisTitle(),
      stringAxisTitle: this.getStringAxisTitle(),
      onStringColumnSelect: this.onStringColumnSelect,
      onLabelChange: this.updateMargins,
      tooltipID: this.props.tooltipID,
      chartTooltipID: this.props.chartTooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement || this.chartContainerRef,
      totalRowsNumber: this.props.totalRowsNumber,
      isChartScaled: this.state.isChartScaled,
      chartID: this.CHART_ID,
      setIsChartScaled: this.setIsChartScaled,
      changeNumberColumnIndices: this.changeNumberColumnIndices,
      rebuildTooltips: this.rebuildTooltips,
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
    const { chartHeight, chartWidth } = this.getChartDimensions()

    // We need to set these inline in order for them to be applied in the exported PNG
    const chartFontFamily = getThemeValue('font-family')
    const chartTextColor = getThemeValue('text-color-primary')
    const chartBackgroundColor = getThemeValue('background-color')

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-chart-${this.CHART_ID}`}
          ref={(r) => (this.chartContainerRef = r)}
          data-test='react-autoql-chart'
          className={`react-autoql-chart-container ${this.state.isLoading || this.props.isResizing ? 'loading' : ''}`}
          style={{
            flexBasis: chartHeight ? `${chartHeight}px` : '100vh',
            pointerEvents: this.state.isLoadingMoreRows ? 'none' : 'unset',
          }}
        >
          {!this.firstRender && !this.props.isResizing && (
            <Fragment>
              {this.state.isLoadingMoreRows && this.renderChartLoader()}
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns='http://www.w3.org/2000/svg'
                width={chartWidth}
                height={chartHeight}
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
