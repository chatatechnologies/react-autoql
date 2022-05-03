import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _reduce from 'lodash.reduce'
import disableScroll from 'disable-scroll'

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
import { SelectableList } from '../../SelectableList'
import { Button } from '../../Button'
import ErrorBoundary from '../../../containers/ErrorHOC/ErrorHOC'

import { svgToPng } from '../../../js/Util.js'
import { getLegendLabelsForMultiSeries, getLegendLocation } from '../helpers.js'

import './ChataChart.scss'
import Popover from 'react-tiny-popover'
import { ChataStackedLineChart } from '../ChataStackedLineChart'
import {
  themeConfigType,
  dataFormattingType,
  dataConfigType,
} from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
  getThemeConfig,
} from '../../../props/defaults'

export default class ChataChart extends Component {
  INNER_PADDING = 0.25
  OUTER_PADDING = 0.5

  constructor(props) {
    super(props)
    const { chartColors } = props.themeConfig

    this.CHART_ID = uuid()
    this.Y_AXIS_LABEL_WIDTH = 15
    this.X_AXIS_LABEL_HEIGHT = 15
    this.PADDING = 20

    this.colorScale = scaleOrdinal().range(chartColors)
    this.filteredSeriesData = this.getFilteredSeriesData(props.data)
    this.firstRender = true
    this.recursiveUpdateCount = 0

    this.state = {
      ...this.getNumberColumnSelectorState(props),
      leftMargin: this.PADDING,
      rightMargin: this.PADDING,
      topMargin: this.PADDING,
      bottomMargin: this.PADDING,
      bottomLegendMargin: 0,
      loading: true,
    }
  }

  DEFAULT_MARGINS = {
    left: 50,
    right: 10,
    bottom: 100,
    top: 10,
  }

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,
    dataConfig: dataConfigType,

    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    tableColumns: PropTypes.arrayOf(PropTypes.shape({})),
    type: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    onLegendClick: PropTypes.func,
    enableDynamicCharting: PropTypes.bool,
    isResizing: PropTypes.bool,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,
    dataConfig: undefined,

    tableColumns: [],
    enableDynamicCharting: true,
    isResizing: false,
    onLegendClick: () => {},
  }

  componentDidMount = () => {
    // The first render is to determine the chart size based on its parent container
    this.firstRender = false
    if (!this.props.isResizing && !this.props.isAnimatingContainer) {
      this.forceUpdate()
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
    const chartWidth = _get(this.chartContainerRef, 'offsetWidth', 0)
    const chartHeight = _get(this.chartContainerRef, 'offsetHeight', 0)
    if (
      !this.state.isLoading &&
      this.recursiveUpdateCount < 2 &&
      (chartWidth !== this.chartWidth || chartHeight !== this.chartHeight)
    ) {
      // Be careful with this to avoid infinite loop
      this.recursiveUpdateCount++
      clearTimeout(this.recursiveUpdateTimeout)
      this.recursiveUpdateTimeout = setTimeout(() => {
        this.recursiveUpdateCount = 0
      }, 500)
      this.forceUpdate()
    }

    if (!this.props.isResizing && prevProps.isResizing) {
      // Fill max message container after resize
      // No need to update margins, they should stay the same
      if (this.chartContainerRef) {
        this.chartContainerRef.style.flexBasis = '100vh'
        this.forceUpdate()
      }
    }

    if (!_isEqual(this.props.dataConfig, prevProps.dataConfig)) {
      this.updateMargins()
    }

    if (
      !_isEqual(this.props.columns, prevProps.columns) ||
      !_isEqual(this.props.dataConfig, prevProps.dataConfig)
    ) {
      this.filteredSeriesData = this.getFilteredSeriesData(this.props.data)
      this.setNumberColumnSelectorState()
    }

    // Disable scrolling while the popover is open
    if (!prevState.activeAxisSelector && this.state.activeAxisSelector) {
      disableScroll.on()
    } else if (prevState.activeAxisSelector && !this.state.activeAxisSelector) {
      disableScroll.off()
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

  getNumberColumnSelectorState = (props) => {
    const { columns } = props
    const { numberColumnIndices } = props.dataConfig

    if (!columns || !numberColumnIndices) {
      return
    }

    const currencyItems = []
    const quantityItems = []
    const ratioItems = []

    columns.forEach((col, i) => {
      const item = {
        content: col.title,
        checked: numberColumnIndices.includes(i),
        columnIndex: i,
      }

      if (col.type === 'DOLLAR_AMT') {
        currencyItems.push(item)
      } else if (col.type === 'QUANTITY') {
        quantityItems.push(item)
      } else if (col.type === 'RATIO' || col.type === 'PERCENT') {
        ratioItems.push(item)
      }
    })

    return {
      activeNumberType: _get(columns, `[${numberColumnIndices[0]}].type`),
      currencySelectorState: currencyItems,
      quantitySelectorState: quantityItems,
      ratioSelectorState: ratioItems,
    }
  }

  setNumberColumnSelectorState = () => {
    this.setState(this.getNumberColumnSelectorState(this.props))
  }

  getNewLeftMargin = (chartContainerBbox, axesBbox) => {
    const containerLeft = chartContainerBbox.x
    const axesLeft = axesBbox.x + containerLeft
    let leftMargin = this.state.leftMargin
    leftMargin +=
      containerLeft - axesLeft + this.Y_AXIS_LABEL_WIDTH + this.PADDING
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

  getNewBottomMargin = (chartContainerBbox) => {
    let legendBBox
    this.legend = select(this.chartRef)
      .select('.legendOrdinal')
      .node()
    legendBBox = this.legend ? this.legend.getBBox() : undefined

    let bottomLegendMargin = 0
    const legendLocation = getLegendLocation(
      _get(this.props.dataConfig, 'numberColumnIndices'),
      this.props.type
    )
    if (legendLocation === 'bottom' && _get(legendBBox, 'height')) {
      bottomLegendMargin = legendBBox.height + 10
    }
    this.xAxis = select(this.chartRef)
      .select('.axis-Bottom')
      .node()
    const xAxisBBox = this.xAxis ? this.xAxis.getBBox() : {}
    let bottomMargin = Math.ceil(xAxisBBox.height) + bottomLegendMargin + 40 // margin to include axis label
    if (xAxisBBox.height === 0) {
      bottomMargin = 463 // if no xAxisBBox available, set bottomMarigin to default as 463
    }
    // only for bar charts (vertical grid lines mess with the axis size)
    if (this.props.type === 'bar' || this.props.type === 'stacked_bar') {
      const innerTickSize =
        chartContainerBbox.height -
        this.state.topMargin -
        this.state.bottomMargin
      bottomMargin = bottomMargin - innerTickSize + 10
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
    return this.state.topMargin
  }

  rebuildTooltips = () => {
    clearTimeout(this.rebuildTooltipsTimer)
    this.rebuildTooltipsTimer = setTimeout(() => {
      ReactTooltip.rebuild()
    }, 500)
  }

  updateMargins = (delay = 100) => {
    if (!this.state.isLoading) {
      this.setState({ isLoading: true })
    }

    clearTimeout(this.updateMarginsThrottled)
    this.updateMarginsThrottled = setTimeout(() => {
      this.updateMarginsToThrottle(delay)
    }, delay)
  }

  updateMarginsToThrottle = () => {
    this.newMargins = undefined

    try {
      this.axes = document.querySelector(
        `#react-autoql-chart-${this.CHART_ID} .react-autoql-axes`
      )

      if (!this.chartContainerRef || !this.axes) {
        this.clearLoading()
        return
      }

      const chartContainerBbox = this.chartContainerRef.getBoundingClientRect()
      const axesBbox = this.axes.getBBox()

      const leftMargin = this.getNewLeftMargin(chartContainerBbox, axesBbox)
      const rightMargin = this.getNewRightMargin(
        chartContainerBbox,
        axesBbox,
        leftMargin
      )
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
          'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Canvas.png'
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
    return _get(
      this.props.tableColumns,
      `[${_get(this.props, 'dataConfig.stringColumnIndex')}].display_name`
    )
  }

  getNumberAxisTitle = () => {
    try {
      const { columns, dataConfig } = this.props
      const numberColumns = columns.filter((col, i) => {
        return _get(dataConfig, 'numberColumnIndices').includes(i)
      })

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
    const {
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
      bottomLegendMargin,
    } = this.state

    const {
      activeChartElementKey,
      enableDynamicCharting,
      dataFormatting,
      onLegendClick,
      onChartClick,
      tableColumns,
      themeConfig,
      columns,
    } = this.props

    const {
      stringColumnIndices,
      numberColumnIndices,
      stringColumnIndex,
      numberColumnIndex,
      legendColumnIndex,
    } = this.props.dataConfig

    let innerPadding = this.INNER_PADDING
    if (numberColumnIndices.length > 1) {
      innerPadding = 0.1
    }

    return {
      data: this.filteredSeriesData,
      colorScale: this.colorScale,
      innerPadding,
      outerPadding: this.OUTER_PADDING,
      onXAxisClick: (e) => {
        this.setState({
          activeAxisSelector: 'x',
          axisSelectorLocation: { left: e.pageX, top: e.pageY },
        })
      },
      onYAxisClick: (e) => {
        this.setState({
          activeAxisSelector: 'y',
          axisSelectorLocation: { left: e.pageX, top: e.pageY },
        })
      },
      onLegendTitleClick: !!this.props.tableColumns[legendColumnIndex]
        ? (e) => {
            this.setState({
              activeAxisSelector: 'legend',
              axisSelectorLocation: { left: e.pageX, top: e.pageY },
            })
          }
        : undefined,
      onLabelChange: this.updateMargins,
      height: this.chartHeight,
      width: this.chartWidth,
      columns,
      tableColumns,
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
      isResizing: this.props.isResizing,
      isAnimatingContainer: this.props.isAnimatingContainer,
      marginAdjustmentFinished: this.state.loading,
      bottomLegendMargin,
      onChartClick,
      dataFormatting,
      themeConfig,
      activeChartElementKey,
      onLegendClick,
      stringColumnIndex,
      stringColumnIndices,
      numberColumnIndex,
      numberColumnIndices,
      numberAxisTitle: this.getNumberAxisTitle(),
      stringAxisTitle: this.getStringAxisTitle(),
      enableDynamicCharting,
      hasMultipleNumberColumns:
        [
          ...this.state.currencySelectorState,
          ...this.state.quantitySelectorState,
          ...this.state.ratioSelectorState,
        ].length > 1,
      hasMultipleStringColumns: stringColumnIndices.length > 1,
      legendLocation: getLegendLocation(numberColumnIndices, this.props.type),
      legendColumn: this.props.tableColumns[legendColumnIndex],
      legendLabels: getLegendLabelsForMultiSeries(
        this.props.columns,
        this.colorScale,
        numberColumnIndices
      ),
    }
  }

  getFilteredSeriesData = (data) => {
    if (_get(data, '[0].cells')) {
      try {
        const filteredSeriesData = data.map((d) => {
          const newCells = d.cells.filter((cell) => {
            return !cell.hidden
          })

          return {
            ...d,
            cells: newCells,
          }
        })

        return filteredSeriesData
      } catch (error) {
        console.error(error)
        return data
      }
    }
    return data
  }

  moveIndexToFront = (index, array) => {
    const newArray = [...array]
    const itemToRemove = array[index]
    newArray.slice(index, index + 1)
    newArray.unshift(itemToRemove)
    return newArray
  }

  renderStringColumnSelectorContent = () => {
    return (
      <div
        className="axis-selector-container"
        id="string-column-selector-content"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <ul className="axis-selector-content">
          {this.props.dataConfig.stringColumnIndices.map((colIndex, i) => {
            return (
              <li
                className={`string-select-list-item ${
                  colIndex === _get(this.props.dataConfig, 'stringColumnIndex')
                    ? 'active'
                    : ''
                }`}
                key={uuid()}
                onClick={() => {
                  this.props.changeStringColumnIndex(colIndex)
                  this.setState({ activeAxisSelector: undefined })
                }}
              >
                {_get(this.props.tableColumns, `[${colIndex}].title`)}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  renderNumberColumnSelectorContent = () => {
    const {
      currencySelectorState,
      quantitySelectorState,
      ratioSelectorState,
    } = this.state

    return (
      <div
        id="chata-chart-popover"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="axis-selector-container">
          {!!currencySelectorState.length && (
            <Fragment>
              <div className="number-selector-header">
                {this.props.dataConfig &&
                this.props.tableColumns &&
                this.props.dataConfig.legendColumnIndex !== undefined
                  ? this.props.tableColumns[
                      this.props.dataConfig.legendColumnIndex
                    ].display_name
                  : 'Currency'}
              </div>
              <SelectableList
                themeConfig={getThemeConfig(this.props.themeConfig)}
                ref={(r) => (this.currencySelectRef = r)}
                items={currencySelectorState}
                onSelect={() => {
                  this.quantitySelectRef && this.quantitySelectRef.unselectAll()
                  this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                }}
                onChange={(currencySelectorState) => {
                  const newQuantitySelectorState = quantitySelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )
                  const newRatioSelectorState = ratioSelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )

                  this.setState({
                    activeNumberType: 'DOLLAR_AMT',
                    currencySelectorState,
                    quantitySelectorState: newQuantitySelectorState,
                    ratioSelectorState: newRatioSelectorState,
                  })
                }}
              />
            </Fragment>
          )}

          {!!quantitySelectorState.length && (
            <Fragment>
              <div className="number-selector-header">
                {' '}
                {this.props.dataConfig &&
                this.props.tableColumns &&
                this.props.dataConfig.legendColumnIndex !== undefined
                  ? this.props.tableColumns[
                      this.props.dataConfig.legendColumnIndex
                    ].display_name
                  : 'Quantity'}
              </div>
              <SelectableList
                themeConfig={getThemeConfig(this.props.themeConfig)}
                ref={(r) => (this.quantitySelectRef = r)}
                items={quantitySelectorState}
                onSelect={() => {
                  this.currencySelectRef && this.currencySelectRef.unselectAll()
                  this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                }}
                onChange={(quantitySelectorState) => {
                  const newCurrencySelectorState = currencySelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )
                  const newRatioSelectorState = ratioSelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )
                  this.setState({
                    activeNumberType: 'QUANTITY',
                    quantitySelectorState,
                    currencySelectorState: newCurrencySelectorState,
                    ratioSelectorState: newRatioSelectorState,
                  })
                }}
              />
            </Fragment>
          )}

          {!!ratioSelectorState.length && (
            <Fragment>
              <div className="number-selector-header">
                {' '}
                {this.props.dataConfig &&
                this.props.tableColumns &&
                this.props.dataConfig.legendColumnIndex !== undefined
                  ? this.props.tableColumns[
                      this.props.dataConfig.legendColumnIndex
                    ].display_name
                  : 'Ratio'}
              </div>
              <SelectableList
                themeConfig={getThemeConfig(this.props.themeConfig)}
                ref={(r) => (this.ratioSelectRef = r)}
                items={ratioSelectorState}
                onSelect={() => {
                  this.currencySelectRef && this.currencySelectRef.unselectAll()
                  this.quantitySelectRef && this.quantitySelectRef.unselectAll()
                }}
                onChange={(ratioSelectorState) => {
                  const newCurrencySelectorState = currencySelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )
                  const newQuantitySelectorState = quantitySelectorState.map(
                    (item) => {
                      return { ...item, checked: false }
                    }
                  )

                  this.setState({
                    activeNumberType: 'RATIO',
                    ratioSelectorState,
                    currencySelectorState: newCurrencySelectorState,
                    quantitySelectorState: newQuantitySelectorState,
                  })
                }}
              />
            </Fragment>
          )}
        </div>
        <div className="axis-selector-apply-btn">
          <Button
            style={{ width: 'calc(100% - 10px)' }}
            type="primary"
            disabled={
              this.state.ratioSelectorState.every((item) => !item.checked) &&
              this.state.currencySelectorState.every((item) => !item.checked) &&
              this.state.quantitySelectorState.every((item) => !item.checked)
            }
            onClick={() => {
              let activeNumberTypeColumns = []
              if (this.state.activeNumberType === 'DOLLAR_AMT') {
                activeNumberTypeColumns = this.state.currencySelectorState
              } else if (this.state.activeNumberType === 'QUANTITY') {
                activeNumberTypeColumns = this.state.quantitySelectorState
              } else if (this.state.activeNumberType === 'RATIO') {
                activeNumberTypeColumns = this.state.ratioSelectorState
              }

              if (activeNumberTypeColumns.length) {
                const activeNumberTypeIndices = activeNumberTypeColumns
                  .filter((item) => item.checked)
                  .map((item) => item.columnIndex)

                this.props.changeNumberColumnIndices(activeNumberTypeIndices)
                this.setState({ activeAxisSelector: undefined })
              }
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    )
  }

  renderLegendSelectorContent = () => {
    if (_get(this.props.dataConfig, 'stringColumnIndices.length', 0) < 2) {
      return null
    }

    return (
      <div
        className="axis-selector-container"
        id="legend-selector-content"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <ul className="axis-selector-content">
          {this.props.dataConfig.stringColumnIndices.map((colIndex, i) => {
            return (
              <li
                className={`string-select-list-item ${
                  colIndex === _get(this.props.dataConfig, 'legendColumnIndex')
                    ? 'active'
                    : ''
                }`}
                key={uuid()}
                onClick={() => {
                  this.props.changeLegendColumnIndex(colIndex)
                  this.setState({ activeAxisSelector: undefined })
                }}
              >
                {_get(this.props.tableColumns, `[${colIndex}].title`)}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  renderAxisSelectorContent = (axis) => {
    try {
      const { type } = this.props
      let content = null

      const hasNumberXAxis = type === 'bar' || type === 'stacked_bar'
      const hasStringYAxis = type === 'bar' || type === 'stacked_bar'
      const hasStringXAxis =
        type === 'column' ||
        type === 'line' ||
        type === 'stacked_column' ||
        type === 'stacked_line'
      const hasNumberYAxis =
        type === 'column' ||
        type === 'line' ||
        type === 'stacked_column' ||
        type === 'stacked_line'

      if (
        (axis === 'x' && hasStringXAxis) ||
        (axis === 'y' && hasStringYAxis)
      ) {
        content = this.renderStringColumnSelectorContent()
      } else if (
        (axis === 'x' && hasNumberXAxis) ||
        (axis === 'y' && hasNumberYAxis)
      ) {
        content = this.renderNumberColumnSelectorContent()
      } else if (axis === 'legend') {
        content = this.renderLegendSelectorContent()
      }

      return content
    } catch (error) {
      console.error(error)
      return null
    }
  }

  renderAxisSelector = (axis) => {
    if (this.state.activeAxisSelector !== axis) {
      return null
    }

    const popoverContent = this.renderAxisSelectorContent(axis)

    return (
      <Popover
        isOpen={this.state.activeAxisSelector === axis}
        content={popoverContent}
        onClickOutside={(e) => {
          if (
            e.pageX !== this.state.axisSelectorLocation.left &&
            e.pageY !== this.state.axisSelectorLocation.top
          ) {
            // Reset axis selections to original
            this.setNumberColumnSelectorState()
            this.setState({ activeAxisSelector: undefined })
          }
        }}
        contentLocation={({
          targetRect,
          popoverRect,
          position,
          align,
          nudgedLeft,
          nudgedTop,
        }) => {
          let topPosition = _get(this.state.axisSelectorLocation, 'top', 0) - 50
          let leftPosition =
            _get(this.state.axisSelectorLocation, 'left', 0) - 75
          const bottomPosition = topPosition + popoverRect.height

          if (bottomPosition > window.innerHeight) {
            topPosition -= bottomPosition - window.innerHeight + 10
          }

          if (leftPosition < 0) {
            leftPosition = 10
          }

          return {
            top: topPosition,
            left: leftPosition,
          }
        }}
      >
        <div />
      </Popover>
    )
  }

  renderAxisSelectors = () => {
    return (
      <Fragment>
        {this.renderAxisSelector('x')}
        {this.renderAxisSelector('y')}
        {this.renderAxisSelector('legend')}
      </Fragment>
    )
  }

  renderColumnChart = () => (
    <ChataColumnChart {...this.getCommonChartProps()} labelValue="label" />
  )

  renderBarChart = () => (
    <ChataBarChart {...this.getCommonChartProps()} labelValue="label" />
  )

  renderLineChart = () => (
    <ChataLineChart {...this.getCommonChartProps()} labelValue="label" />
  )

  renderPieChart = () => {
    return (
      <ChataPieChart
        {...this.getCommonChartProps()}
        labelValue="label"
        backgroundColor={this.props.backgroundColor}
      />
    )
  }

  renderHeatmapChart = () => (
    <ChataHeatmapChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelY"
      labelValueY="labelX"
    />
  )

  renderBubbleChart = () => (
    <ChataBubbleChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelY"
      labelValueY="labelX"
    />
  )

  renderStackedColumnChart = () => (
    <ChataStackedColumnChart {...this.getCommonChartProps()} />
  )

  renderStackedBarChart = () => (
    <ChataStackedBarChart {...this.getCommonChartProps()} />
  )

  renderStackedLineChart = () => (
    <ChataStackedLineChart {...this.getCommonChartProps()} />
  )

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
    this.chartWidth = _get(this.chartContainerRef, 'offsetWidth', 0)
    this.chartHeight = _get(this.chartContainerRef, 'offsetHeight', 0)

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-chart-${this.CHART_ID}`}
          ref={(r) => (this.chartContainerRef = r)}
          data-test="react-autoql-chart"
          className={`react-autoql-chart-container ${
            this.state.isLoading ||
            this.props.isAnimatingContainer ||
            this.props.isResizing
              ? 'loading'
              : ''
          }`}
          style={{
            flexBasis: this.chartHeight ? `${this.chartHeight}px` : '100vh',
          }}
        >
          {!this.firstRender && !this.props.isAnimatingContainer && (
            <Fragment>
              <svg
                ref={(r) => (this.chartRef = r)}
                xmlns="http://www.w3.org/2000/svg"
                width={this.chartWidth}
                height={this.chartHeight}
                style={{
                  fontFamily: _get(
                    getThemeConfig(this.props.themeConfig),
                    'font-family',
                    'sans-serif'
                  ),
                  color: _get(
                    getThemeConfig(this.props.themeConfig),
                    'text-color-primary',
                    'inherit'
                  ),
                  background: _get(
                    getThemeConfig(this.props.themeConfig),
                    'background-color',
                    'inherit'
                  ),
                }}
              >
                <g className="react-autoql-chart-content-container">
                  {this.renderChart()}
                </g>
              </svg>
              {this.renderAxisSelectors()}
            </Fragment>
          )}
        </div>
      </ErrorBoundary>
    )
  }
}
