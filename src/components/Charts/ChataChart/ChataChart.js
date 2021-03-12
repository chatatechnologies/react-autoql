import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'
import _get from 'lodash.get'

import { select } from 'd3-selection'
import { max } from 'd3-array'
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

import { svgToPng, awaitTimeout } from '../../../js/Util.js'
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
  getDataFormatting,
  getThemeConfig,
} from '../../../props/defaults'
import _isEqual from 'lodash.isequal'

export default class ChataChart extends Component {
  INNER_PADDING = 0.25
  OUTER_PADDING = 0.5

  constructor(props) {
    super(props)
    const { chartColors } = props.themeConfig

    this.colorScale = scaleOrdinal().range(chartColors)
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
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,
    dataConfig: undefined,

    tableColumns: [],
    enableDynamicCharting: true,
    onLegendClick: () => {},
  }

  state = {
    leftMargin: 50,
    rightMargin: 10,
    topMargin: 10,
    bottomMargin: 100,
    bottomLegendMargin: 0,

    currencySelectorState: [],
    quantitySelectorState: [],
    ratioSelectorState: [],
  }

  componentDidMount = () => {
    this.CHART_ID = uuid.v4()
    if (this.props.type !== 'pie') {
      this.updateMargins()
    }

    this.setNumberColumnSelectorState()
  }

  componentDidUpdate = (prevProps) => {
    if (!this.props.isResizing && prevProps.isResizing) {
      this.updateMargins()
    }

    if (!_isEqual(this.props.dataConfig, prevProps.dataConfig)) {
      this.updateMargins()
    }

    if (
      this.props.type &&
      this.props.type !== prevProps.type &&
      this.props.type !== 'pie'
    ) {
      this.updateMargins()
      ReactTooltip.rebuild()
    }
  }

  setNumberColumnSelectorState = () => {
    const { columns } = this.props
    const { numberColumnIndices } = this.props.dataConfig

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

    this.setState({
      activeNumberType: _get(columns, `[${numberColumnIndices[0]}].type`),
      currencySelectorState: currencyItems,
      quantitySelectorState: quantityItems,
      ratioSelectorState: ratioItems,
    })
  }

  getNewLeftMargin = () => {
    // todo
    // get left part of #react-autoql-chart-95c56ed0-8345-4af4-bc76-805cbaf2a0ed
    // get left part of .react-autoql-axes
    // see if .react-autoql-axes is further left, and move that much to the right
    // then there is no need to calculate text lengths

    const xAxis = select(this.chartRef)
      .select('.axis-Bottom')
      .node()
    const xAxisBBox = xAxis ? xAxis.getBBox() : {}
    const yAxisLabels = select(this.chartRef)
      .select('.axis-Left')
      .selectAll('text')
    const maxYLabelWidth = max(yAxisLabels.nodes(), (n) =>
      n.getComputedTextLength()
    )
    let leftMargin = Math.ceil(maxYLabelWidth) + 55 // margin to include axis label
    if (xAxisBBox.width > this.props.width) {
      leftMargin += xAxisBBox.width - this.props.width
    }

    return { leftMargin }
  }

  // Keep this in case we need it later
  getNewTopMargin = () => {
    const topMargin = 20
    return { topMargin }
  }

  getNewRightMargin = () => {
    let rightMargin = this.state.rightMargin

    // If the non-rotated labels (on the right side) in the x axis exceed the width of the chart, use that instead
    const chartElement = select(this.chartRef)
      .select('.react-autoql-axes')
      .node()

    const chartBBox = chartElement ? chartElement.getBBox() : undefined
    if (chartBBox) {
      rightMargin += chartBBox.width - this.props.width + 20
    }

    // * This should be taken care of by the above code
    // * but I want to keep it around for a bit longer
    // const legend = select(this.chartRef)
    //   .select('.legendOrdinal-container')
    //   .node()
    // const legendBBox = legend ? legend.getBBox() : undefined
    // const legendLocation = getLegendLocation(this.props.data, this.props.type)
    // if (legendLocation === 'right' && _get(legendBBox, 'width')) {
    //   rightMargin += legendBBox.width
    // }

    return { rightMargin }
  }

  getNewBottomMargin = () => {
    let legendBBox
    const legend = select(this.chartRef)
      .select('.legendOrdinal')
      .node()
    legendBBox = legend ? legend.getBBox() : undefined

    let bottomLegendMargin = 0
    const legendLocation = getLegendLocation(
      _get(this.props.dataConfig, 'numberColumnIndices'),
      this.props.type
    )

    if (legendLocation === 'bottom' && _get(legendBBox, 'height')) {
      bottomLegendMargin = legendBBox.height + 10
    }

    const xAxis = select(this.chartRef)
      .select('.axis-Bottom')
      .node()
    const xAxisBBox = xAxis ? xAxis.getBBox() : {}
    let bottomMargin = Math.ceil(xAxisBBox.height) + bottomLegendMargin + 40 // margin to include axis label

    // only for bar charts (vertical grid lines mess with the axis size)
    if (this.props.type === 'bar' || this.props.type === 'stacked_bar') {
      const innerTickSize =
        this.props.height - this.state.topMargin - this.state.bottomMargin
      bottomMargin = bottomMargin - innerTickSize + 10
    }

    return {
      bottomMargin: bottomMargin || this.state.bottomMargin,
      bottomLegendMargin,
      // bottomLegendWidth
    }
  }

  updateMargins = (delay = 0) => {
    this.setState({ isLoading: true })
    try {
      awaitTimeout(delay, () => {
        const newLeftMargin = this.getNewLeftMargin()
        const newTopMargin = this.getNewTopMargin()
        this.setState({
          ...newLeftMargin,
          ...newTopMargin,
        })
      }).then(() => {
        awaitTimeout(delay, () => {
          const newRightMargin = this.getNewRightMargin()
          const newBottomMargin = this.getNewBottomMargin()
          this.setState({
            ...newRightMargin,
            ...newBottomMargin,
          })
        }).then(() => {
          setTimeout(() => {
            this.setState({ isLoading: false })
          }, 0)
        })
      })
    } catch (error) {
      // Something went wrong rendering the chart.
      console.error(error)
      this.setState({ isLoading: false })
    }
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
        document.body.removeChild(link)
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
      height,
      width,
      data,
    } = this.props

    const {
      stringColumnIndices,
      numberColumnIndices,
      stringColumnIndex,
      numberColumnIndex,
      legendColumnIndex,
    } = this.props.dataConfig

    const filteredSeriesData = this.getFilteredSeriesData(data)

    let innerPadding = this.INNER_PADDING
    if (numberColumnIndices.length > 1) {
      innerPadding = 0.1
    }

    return {
      data: filteredSeriesData,
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
      height,
      width,
      columns,
      tableColumns,
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
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
      <div className="axis-selector-container">
        <ul className="axis-selector-content">
          {this.props.dataConfig.stringColumnIndices.map((colIndex, i) => {
            return (
              <li
                className={`string-select-list-item ${
                  colIndex === _get(this.props.dataConfig, 'stringColumnIndex')
                    ? 'active'
                    : ''
                }`}
                key={uuid.v4()}
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
      <div>
        <div className="axis-selector-container">
          {!!currencySelectorState.length && (
            <Fragment>
              <div className="number-selector-header">Currency</div>
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
              <div className="number-selector-header">Quantity</div>
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
              <div className="number-selector-header">Ratio</div>
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
      <div className="axis-selector-container">
        <ul className="axis-selector-content">
          {this.props.dataConfig.stringColumnIndices.map((colIndex, i) => {
            return (
              <li
                className={`string-select-list-item ${
                  colIndex === _get(this.props.dataConfig, 'legendColumnIndex')
                    ? 'active'
                    : ''
                }`}
                key={uuid.v4()}
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
    const popoverContent = this.renderAxisSelectorContent(axis)

    if (!popoverContent) {
      return null
    }

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

  renderBarChart = () => {
    return <ChataBarChart {...this.getCommonChartProps()} labelValue="label" />
  }

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

  render = () => {
    let chart

    switch (this.props.type) {
      case 'column': {
        chart = this.renderColumnChart()
        break
      }
      case 'bar': {
        chart = this.renderBarChart()
        break
      }
      case 'line': {
        chart = this.renderLineChart()
        break
      }
      case 'pie': {
        chart = this.renderPieChart()
        break
      }
      case 'bubble': {
        chart = this.renderBubbleChart()
        break
      }
      case 'heatmap': {
        chart = this.renderHeatmapChart()
        break
      }
      case 'stacked_column': {
        chart = this.renderStackedColumnChart()
        break
      }
      case 'stacked_bar': {
        chart = this.renderStackedBarChart()
        break
      }
      case 'stacked_line': {
        chart = this.renderStackedLineChart()
        break
      }
      default: {
        chart = 'Unknown Display Type'
        break
      }
    }

    return (
      <ErrorBoundary>
        <div
          id={`react-autoql-chart-${this.CHART_ID}`}
          className={`react-autoql-chart-container ${
            this.state.isLoading ? 'loading' : ''
          }`}
          data-test="react-autoql-chart"
        >
          <svg
            ref={(r) => (this.chartRef = r)}
            xmlns="http://www.w3.org/2000/svg"
            width={this.props.width}
            height={this.props.height}
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
            <g className="react-autoql-chart-content-container">{chart}</g>
          </svg>
          {this.renderAxisSelectors()}
        </div>
      </ErrorBoundary>
    )
  }
}
