import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _sortBy from 'lodash.sortby'
import _cloneDeep from 'lodash.clonedeep'
import _isEmpty from 'lodash.isempty'

import { select } from 'd3-selection'
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
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'
import { svgToPng, sortDataByDate, formatChartLabel } from '../../../js/Util.js'
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

export default class ChataChart extends Component {
  constructor(props) {
    super(props)
    const chartColors = getChartColorVars()

    this.CHART_ID = uuid()
    this.PADDING = 20
    this.INNER_PADDING = 0.25
    this.OUTER_PADDING = 0.5
    this.AXIS_LABEL_PADDING = 30
    this.TWO_AXIS_LABEL_PADDING = 60
    this.DEFAULT_BOTTOM_MARGIN = 100

    this.firstRender = true
    this.recursiveUpdateCount = 0

    this.colorScale = scaleOrdinal().range(chartColors)
    this.state = {
      aggregatedData: this.aggregateRowData(props),
      leftMargin: this.PADDING,
      rightMargin: this.PADDING,
      topMargin: this.PADDING,
      bottomMargin: this.PADDING,
      bottomLegendMargin: 0,
      loading: true,
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

    if (this.props.type !== prevProps.type) {
      this.rebuildTooltips()
    }

    if (dataStructureChanged(this.props, prevProps)) {
      shouldUpdateMargins = true
      newState.aggregatedData = this.aggregateRowData(this.props)
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
    const { topMargin, bottomMargin, rightMargin, leftMargin } = this.state

    let chartWidth = this.props.width ?? this.chartContainerRef?.clientWidth
    if (chartWidth < 0) {
      chartWidth = 0
    }

    let chartHeight = this.props.height ?? this.chartContainerRef?.clientHeight
    if (chartHeight < 0) {
      chartHeight = 0
    }

    let innerHeight = chartHeight - bottomMargin - topMargin
    if (innerHeight < 0) {
      innerHeight = 0
    }

    let innerWidth = chartWidth - leftMargin - rightMargin
    if (innerWidth < 0) {
      innerWidth = 0
    }

    return { chartHeight, chartWidth, innerHeight, innerWidth }
  }

  aggregateRowData = (props) => {
    const { stringColumnIndex, numberColumnIndices, data, columns } = props
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

    let rowSum = _cloneDeep(sortedData[0])
    sortedData.forEach((currentRow, i) => {
      const currentCategory =
        formatChartLabel({
          d: currentRow?.[stringColumnIndex],
          col: stringColumn,
          config: this.props.dataFormatting,
        })?.fullWidthLabel ?? currentRow?.[stringColumnIndex]
      const prevCategory =
        formatChartLabel({
          d: rowSum?.[stringColumnIndex],
          col: stringColumn,
          config: this.props.dataFormatting,
        })?.fullWidthLabel ?? rowSum?.[stringColumnIndex]

      if (i === 0 && i < sortedData.length - 1) {
        return
      } else if (currentCategory !== prevCategory) {
        aggregatedData.push(rowSum)
        rowSum = _cloneDeep(currentRow)
      } else {
        const newRow = _cloneDeep(currentRow)
        numberColumnIndices.forEach((columnIndex) => {
          let currentValue = Number(newRow[columnIndex])
          let sumValue = Number(rowSum[columnIndex])
          if (isNaN(currentValue)) {
            currentValue = 0
          }
          if (isNaN(sumValue)) {
            sumValue = 0
          }
          newRow[columnIndex] = currentValue + sumValue
        })

        rowSum = newRow
      }

      if (i === sortedData.length - 1) {
        aggregatedData.push(rowSum)
      }
    })
    return aggregatedData
  }

  getNewLeftMargin = (chartContainerBbox, axesBbox) => {
    const containerLeft = chartContainerBbox.x
    const axesLeft = axesBbox.x + containerLeft
    let leftMargin = this.state.leftMargin

    leftMargin += containerLeft - axesLeft + this.AXIS_LABEL_PADDING
    return leftMargin
  }

  getNewRightMargin = (chartContainerBbox, axesBbox, leftMargin) => {
    const axesLeft = axesBbox.x + chartContainerBbox.x
    const axesRight = axesLeft + axesBbox.width
    const containerRight = chartContainerBbox.x + chartContainerBbox.width
    const rightDiff = axesRight - containerRight

    const leftMarginDiff = leftMargin - this.state.leftMargin
    const maxMargin = chartContainerBbox.width - leftMarginDiff
    const calculatedMargin = this.state.rightMargin + rightDiff + this.PADDING

    let rightMargin = this.state.rightMargin
    if (calculatedMargin < maxMargin) {
      rightMargin = calculatedMargin
    } else {
      rightMargin = this.PADDING
    }

    return rightMargin
  }

  getLegendLabels = () => {
    return getLegendLabelsForMultiSeries(this.props.columns, this.colorScale, this.props.numberColumnIndices)
  }

  getNewBottomMargin = (chartContainerBbox, axesBbox) => {
    let legendBBox
    this.legend = select(this.chartRef).select('.legendOrdinal').node()
    legendBBox = this.legend ? this.legend.getBBox() : undefined

    let bottomLegendMargin = 0
    const legendLocation = getLegendLocation(this.props.numberColumnIndices, this.props.type)
    if (legendLocation === 'bottom' && _get(legendBBox, 'height')) {
      bottomLegendMargin = legendBBox.height + 10
    }

    this.xAxis = select(this.chartRef).select('.axis-Bottom').node()

    const xAxisBBox = this.xAxis ? this.xAxis.getBBox() : {}
    let bottomMargin = Math.ceil(xAxisBBox.height) + bottomLegendMargin + this.AXIS_LABEL_PADDING // margin to include axis label
    if (this.props.totalRowsNumber >= 50) {
      bottomMargin = Math.ceil(xAxisBBox.height) + bottomLegendMargin + this.TWO_AXIS_LABEL_PADDING // margin to include 2 axis label
    }
    if (xAxisBBox.height === 0) {
      bottomMargin = this.DEFAULT_BOTTOM_MARGIN // if no xAxisBBox available, set bottomMargin to default as 463
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

      const leftMargin = this.getNewLeftMargin(chartContainerBbox, axesBbox)
      const rightMargin = this.getNewRightMargin(chartContainerBbox, axesBbox, leftMargin)
      const topMargin = this.getNewTopMargin()
      const bottomMargin = this.getNewBottomMargin(chartContainerBbox, axesBbox)

      this.newMargins = {
        leftMargin,
        topMargin,
        rightMargin,
        bottomMargin,
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

    const { leftMargin, topMargin, rightMargin, bottomMargin } = this.newMargins
    const leftDiff = Math.abs(leftMargin - this.state.leftMargin)
    const topDiff = Math.abs(topMargin - this.state.topMargin)
    const rightDiff = Math.abs(rightMargin - this.state.rightMargin)
    const bottomDiff = Math.abs(bottomMargin - this.state.bottomMargin)

    return leftDiff > 10 || topDiff > 10 || rightDiff > 10 || bottomDiff > 10
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
    try {
      const numberColumns = columns.filter((col, i) => {
        return numberColumnIndices.includes(i)
      })

      if (!numberColumns?.length) {
        return undefined
      }

      // If there are different titles for any of the columns, return a generic label based on the type
      const allTitlesEqual = !numberColumns.find((col) => {
        return col.display_name !== numberColumns[0].display_name
      })

      if (allTitlesEqual) {
        return _get(numberColumns, '[0].display_name')
      }

      const columnType = _get(numberColumns, '[0].type')
      if (columnType === 'DOLLAR_AMT') {
        return 'Amount'
      } else if (columnType === 'QUANTITY') {
        return 'Quantity'
      } else if (columnType === 'RATIO') {
        return 'Ratio'
      } else if (columnType === 'PERCENT') {
        return 'Percent'
      }

      return undefined
    } catch (error) {
      console.error(error)
      return undefined
    }
  }

  getCommonChartProps = () => {
    const { topMargin, bottomMargin, rightMargin, leftMargin, bottomLegendMargin } = this.state
    console.log('526', this.props)
    const { numberColumnIndices, columns } = this.props

    let innerPadding = this.INNER_PADDING
    if (numberColumnIndices.length > 1) {
      innerPadding = 0.1
    }

    const { amountOfNumberColumns, amountOfStringColumns } = getColumnTypeAmounts(columns)
    const hasMultipleNumberColumns = amountOfNumberColumns > 1
    const hasMultipleStringColumns = amountOfStringColumns > 1

    const visibleSeriesIndices = numberColumnIndices.filter(
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
      innerWidth,
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
      bottomLegendMargin,
      hasMultipleNumberColumns,
      hasMultipleStringColumns,
      marginAdjustmentFinished: this.state.loading,
      legendTitle: this.props.legendColumn?.title || 'Category',
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendLabels: this.getLegendLabels(),
      visibleSeriesIndices,
      numberAxisTitle: this.getNumberAxisTitle(),
      stringAxisTitle: this.getStringAxisTitle(),
      onStringColumnSelect: this.onStringColumnSelect,
      onLabelChange: this.updateMargins,
      tooltipID: this.props.tooltipID,
      chartContainerRef: this.chartContainerRef,
      popoverParentElement: this.props.popoverParentElement || this.chartContainerRef,
      totalRowsNumber: this.props.totalRowsNumber,
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
  renderColumnChart = (dataType) => <ChataColumnChart {...this.getCommonChartProps({ dataType })} />

  renderBarChart = (dataType) => <ChataBarChart {...this.getCommonChartProps({ dataType })} />

  renderLineChart = (dataType) => <ChataLineChart {...this.getCommonChartProps({ dataType })} />

  renderPieChart = () => <ChataPieChart {...this.getCommonChartProps()} />

  renderHeatmapChart = () => <ChataHeatmapChart {...this.getCommonChartProps()} />

  renderBubbleChart = () => <ChataBubbleChart {...this.getCommonChartProps()} />

  renderStackedColumnChart = () => <ChataStackedColumnChart {...this.getCommonChartProps()} />

  renderStackedBarChart = (dataType) => <ChataStackedBarChart {...this.getCommonChartProps({ dataType })} />

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
