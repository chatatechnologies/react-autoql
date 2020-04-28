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

import { svgToPng, formatElement } from '../../../js/Util.js'
import { getLegendLabelsForMultiSeries, getLegendLocation } from '../helpers.js'

import './ChataChart.scss'
import Popover from 'react-tiny-popover'

export default class ChataChart extends Component {
  INNER_PADDING = 0.5
  OUTER_PADDING = 2

  constructor(props) {
    super(props)
    const { chartColors } = props

    this.colorScale = scaleOrdinal().range(chartColors)
  }

  DEFAULT_MARGINS = {
    left: 50,
    right: 10,
    bottom: 100,
    top: 10
  }

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    type: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    chartColors: PropTypes.arrayOf(PropTypes.string).isRequired,
    onLegendClick: PropTypes.func,
    enableAxisSelection: PropTypes.bool.isRequired,
    dataFormatting: PropTypes.shape({
      currencyCode: PropTypes.string,
      languageCode: PropTypes.string,
      currencyDecimals: PropTypes.number,
      quantityDecimals: PropTypes.number,
      comparisonDisplay: PropTypes.string,
      monthYearFormat: PropTypes.string,
      dayMonthYearFormat: PropTypes.string
    })
  }

  static defaultProps = {
    dataFormatting: {},
    onLegendClick: () => {}
  }

  state = {
    leftMargin: 50,
    rightMargin: 10,
    topMargin: 10,
    bottomMargin: 100,
    // bottomLegendWidth: 0,
    bottomLegendMargin: 0,

    currencySelectorState: [],
    quantitySelectorState: [],
    ratioSelectorState: []
  }

  componentDidMount = () => {
    this.CHART_ID = uuid.v4()
    if (this.props.type !== 'pie') {
      this.updateMargins()
    }

    this.setNumberColumnSelectorState()
  }

  componentDidUpdate = prevProps => {
    if (!this.props.isResizing && prevProps.isResizing) {
      this.updateMargins(350)
    }

    if (
      this.props.stringColumnIndex !== prevProps.stringColumnIndex ||
      this.props.numberColumnIndices != prevProps.numberColumnIndices
    ) {
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
    const { columns, numberColumnIndices } = this.props

    if (!columns || !numberColumnIndices) {
      return
    }

    const currencyItems = []
    const quantityItems = []
    const ratioItems = []

    columns.forEach((col, i) => {
      const item = {
        content: col.display_name,
        checked: numberColumnIndices.includes(i),
        columnIndex: i
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
      ratioSelectorState: ratioItems
    })
  }

  getNewLeftMargin = () => {
    // todo
    // get left part of #chata-chart-95c56ed0-8345-4af4-bc76-805cbaf2a0ed
    // get left part of .chata-axes
    // see if .chata-axes is further left, and move that much to the right
    // then there is no need to calculate text lengths

    const xAxis = select(this.chartRef)
      .select('.axis-Bottom')
      .node()
    const xAxisBBox = xAxis ? xAxis.getBBox() : {}
    const yAxisLabels = select(this.chartRef)
      .select('.axis-Left')
      .selectAll('text')
    const maxYLabelWidth = max(yAxisLabels.nodes(), n =>
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
      .select('.chata-axes')
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
      .select('.legendOrdinal-container')
      .node()
    legendBBox = legend ? legend.getBBox() : undefined

    let bottomLegendMargin = 0
    const legendLocation = getLegendLocation(
      this.props.numberColumnIndices,
      this.props.type
    )

    if (legendLocation === 'bottom' && _get(legendBBox, 'height')) {
      bottomLegendMargin = legendBBox.height + 20
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
      bottomLegendMargin
      // bottomLegendWidth
    }
  }

  updateMargins = (delay = 0) => {
    try {
      setTimeout(() => {
        const newLeftMargin = this.getNewLeftMargin()
        const newTopMargin = this.getNewTopMargin()
        this.setState({
          ...newLeftMargin,
          ...newTopMargin
        })
      }, delay)

      setTimeout(() => {
        const newRightMargin = this.getNewRightMargin()
        const newBottomMargin = this.getNewBottomMargin()
        this.setState({
          ...newRightMargin,
          ...newBottomMargin
        })
      }, delay)
    } catch (error) {
      // Something went wrong rendering the chart.
      console.error(error)
    }
  }

  tooltipFormatter2D = (data, colIndex) => {
    const { columns, stringColumnIndex, numberColumnIndices } = this.props
    const labelCol = columns[stringColumnIndex]
    const valueCols = columns.filter((col, i) =>
      numberColumnIndices.includes(i)
    ) // Supports multi-series

    if (!labelCol || !valueCols || !(colIndex >= 0)) {
      return null
    }

    try {
      const tooltipElement = `<div>
      <div>
        <strong>${labelCol.title}:</strong> ${formatElement({
        element: data.label,
        column: labelCol,
        config: this.props.dataFormatting
      })}
      </div>
      <div><strong>${valueCols[colIndex].title}:</strong> ${formatElement({
        element: data.cells[colIndex].value,
        column: valueCols[colIndex],
        config: this.props.dataFormatting
      })}
      </div>
    </div>`
      return tooltipElement
    } catch (error) {
      console.error(error)
      return null
    }
  }

  tooltipFormatter3D = data => {
    const { columns } = this.props
    const labelColX = columns[1]
    const labelColY = columns[0]
    const valueCol = columns[2] // Only one value - does not support multi-series

    if (!labelColX || !labelColY || !valueCol) {
      return null
    }

    return `<div>
    <div>
      <strong>${labelColY.title}:</strong> ${formatElement({
      element: data.labelY,
      column: labelColY,
      config: this.props.dataFormatting
    })}
    </div>
    <div>
      <strong>${labelColX.title}:</strong> ${formatElement({
      element: data.labelX,
      column: labelColX,
      config: this.props.dataFormatting
    })}
    </div>
    <div>
      <strong>${valueCol.title}:</strong> ${formatElement({
      element: data.value,
      column: valueCol,
      config: this.props.dataFormatting
    })}
    </div>
  </div>`
  }

  saveAsPNG = () => {
    const svgElement = this.chartRef
    if (!svgElement) {
      return
    }

    svgToPng(svgElement, 20)
      .then(data => {
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
      .catch(error => {
        console.error(error)
      })
  }

  getNumberAxisTitle = () => {
    if (_get(this.props.numberColumnIndices, 'length', 0) <= 1) {
      return undefined
    }

    try {
      const columnType = this.props.columns.find(
        (col, i) => i === this.props.numberColumnIndices[0]
      ).type

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
      bottomLegendMargin
      // bottomLegendWidth
    } = this.state

    const {
      width,
      height,
      data,
      columns,
      onChartClick,
      chartColors,
      activeChartElementKey,
      dataFormatting,
      onLegendClick,
      stringColumnIndex,
      stringColumnIndices,
      numberColumnIndex,
      numberColumnIndices,
      enableAxisSelection
    } = this.props

    const filteredSeriesData = this.getFilteredSeriesData(data)

    return {
      data: filteredSeriesData,
      colorScale: this.colorScale,
      innerPadding: this.INNER_PADDING,
      outerPadding: this.OUTER_PADDING,
      onXAxisClick: e => {
        this.setState({
          activeAxisSelector: 'x',
          axisSelectorLocation: { left: e.pageX, top: e.pageY }
        })
      },
      onYAxisClick: e => {
        this.setState({
          activeAxisSelector: 'y',
          axisSelectorLocation: { left: e.pageX, top: e.pageY }
        })
      },
      onLabelChange: () => {},
      height,
      width,
      columns,
      topMargin,
      bottomMargin,
      rightMargin,
      leftMargin,
      bottomLegendMargin,
      onChartClick,
      dataFormatting,
      chartColors,
      activeChartElementKey,
      onLegendClick,
      stringColumnIndex,
      stringColumnIndices,
      numberColumnIndex,
      numberColumnIndices,
      numberAxisTitle: this.getNumberAxisTitle(),
      enableAxisSelection,
      hasMultipleNumberColumns:
        [
          ...this.state.currencySelectorState,
          ...this.state.quantitySelectorState,
          ...this.state.ratioSelectorState
        ].length > 1,
      hasMultipleStringColumns:
        _get(this.props.stringColumnIndices, 'length', 0) > 1,
      legendLocation: getLegendLocation(
        this.props.numberColumnIndices,
        this.props.type
      )
    }
  }

  getFilteredSeriesData = data => {
    if (_get(data, '[0].cells')) {
      try {
        const filteredSeriesData = data.map(d => {
          const newCells = d.cells.filter(cell => {
            return !cell.hidden
          })

          return {
            ...d,
            cells: newCells
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

  renderStringColumnSelector = () => {
    return (
      <div className="axis-selector-container">
        <ul className="axis-selector-content">
          {this.props.stringColumnIndices.map((colIndex, i) => {
            return (
              <li
                className={`string-select-list-item ${
                  colIndex === this.props.stringColumnIndex ? 'active' : ''
                }`}
                key={uuid.v4()}
                onClick={() => {
                  this.props.changeStringColumnIndex(colIndex)
                  this.setState({ activeAxisSelector: undefined })
                }}
              >
                {_get(this.props.columns, `[${colIndex}].display_name`)}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  renderNumberColumnSelector = () => {
    const {
      currencySelectorState,
      quantitySelectorState,
      ratioSelectorState
    } = this.state

    return (
      <div>
        <div className="axis-selector-container">
          {!!currencySelectorState.length && (
            <Fragment>
              <div className="number-selector-header">Currency</div>
              <SelectableList
                ref={r => (this.currencySelectRef = r)}
                items={currencySelectorState}
                onSelect={() => {
                  this.quantitySelectRef && this.quantitySelectRef.unselectAll()
                  this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                }}
                onChange={currencySelectorState => {
                  const newQuantitySelectorState = quantitySelectorState.map(
                    item => {
                      return { ...item, checked: false }
                    }
                  )
                  const newRatioSelectorState = ratioSelectorState.map(item => {
                    return { ...item, checked: false }
                  })

                  this.setState({
                    activeNumberType: 'DOLLAR_AMT',
                    currencySelectorState,
                    quantitySelectorState: newQuantitySelectorState,
                    ratioSelectorState: newRatioSelectorState
                  })
                }}
              />
            </Fragment>
          )}

          {!!quantitySelectorState.length && (
            <Fragment>
              <div className="number-selector-header">Quantity</div>
              <SelectableList
                ref={r => (this.quantitySelectRef = r)}
                items={quantitySelectorState}
                onSelect={() => {
                  this.currencySelectRef && this.currencySelectRef.unselectAll()
                  this.ratioSelectRef && this.ratioSelectRef.unselectAll()
                }}
                onChange={quantitySelectorState => {
                  const newCurrencySelectorState = currencySelectorState.map(
                    item => {
                      return { ...item, checked: false }
                    }
                  )
                  const newRatioSelectorState = ratioSelectorState.map(item => {
                    return { ...item, checked: false }
                  })
                  this.setState({
                    activeNumberType: 'QUANTITY',
                    quantitySelectorState,
                    currencySelectorState: newCurrencySelectorState,
                    ratioSelectorState: newRatioSelectorState
                  })
                }}
              />
            </Fragment>
          )}

          {!!ratioSelectorState.length && (
            <Fragment>
              <div className="number-selector-header">Ratio</div>
              <SelectableList
                ref={r => (this.ratioSelectRef = r)}
                items={ratioSelectorState}
                onSelect={() => {
                  this.currencySelectRef && this.currencySelectRef.unselectAll()
                  this.quantitySelectRef && this.quantitySelectRef.unselectAll()
                }}
                onChange={ratioSelectorState => {
                  const newCurrencySelectorState = currencySelectorState.map(
                    item => {
                      return { ...item, checked: false }
                    }
                  )
                  const newQuantitySelectorState = quantitySelectorState.map(
                    item => {
                      return { ...item, checked: false }
                    }
                  )
                  this.setState({
                    activeNumberType: 'RATIO',
                    ratioSelectorState,
                    currencySelectorState: newCurrencySelectorState,
                    quantitySelectorState: newQuantitySelectorState
                  })
                }}
              />
            </Fragment>
          )}

          {
            //   <ul className="axis-selector-content">
            //   {this.props.numberColumnIndices.map((colIndex, i) => {
            //     return (
            //       <li
            //         key={uuid.v4()}
            //         onClick={() => {
            //           this.props.changeNumberColumnIndex(colIndex)
            //           this.setState({ activeAxisSelector: undefined })
            //         }}
            //       >
            //         {_get(this.props.columns, `[${colIndex}].display_name`)}
            //       </li>
            //     )
            //   })
            // }
            // </ul>
          }
        </div>
        <div style={{ background: '#fff', padding: '5px' }}>
          <Button
            style={{ width: 'calc(100% - 10px)' }}
            type="primary"
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
                  .filter(item => item.checked)
                  .map(item => item.columnIndex)

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

  renderAxisSelectorContent = axis => {
    try {
      const { type } = this.props
      let content = null

      const hasNumberXAxis = type === 'bar'
      const hasStringYAxis = type === 'bar'
      const hasStringXAxis = type === 'column' || type === 'line'
      const hasNumberYAxis = type === 'column' || type === 'line'

      if (
        (axis === 'x' && hasStringXAxis) ||
        (axis === 'y' && hasStringYAxis)
      ) {
        content = this.renderStringColumnSelector()
      } else if (
        (axis === 'x' && hasNumberXAxis) ||
        (axis === 'y' && hasNumberYAxis)
      ) {
        content = this.renderNumberColumnSelector()
      }

      return content
    } catch (error) {
      console.error(error)
      return null
    }
  }

  renderAxisSelector = axis => {
    const popoverContent = this.renderAxisSelectorContent(axis)

    if (!popoverContent) {
      return null
    }

    return (
      <Popover
        isOpen={this.state.activeAxisSelector === axis}
        content={popoverContent}
        onClickOutside={e => {
          if (
            e.pageX !== this.state.axisSelectorLocation.left &&
            e.pageY !== this.state.axisSelectorLocation.top
          ) {
            this.setState({ activeAxisSelector: undefined })
          }
        }}
        contentLocation={({
          targetRect,
          popoverRect,
          position,
          align,
          nudgedLeft,
          nudgedTop
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
            left: leftPosition
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
      </Fragment>
    )
  }

  renderColumnChart = () => (
    <ChataColumnChart
      {...this.getCommonChartProps()}
      labelValue="label"
      tooltipFormatter={this.tooltipFormatter2D}
      legendLabels={getLegendLabelsForMultiSeries(
        this.props.columns,
        this.colorScale,
        this.props.numberColumnIndices
      )}
    />
  )

  renderBarChart = () => {
    return (
      <ChataBarChart
        {...this.getCommonChartProps()}
        labelValue="label"
        tooltipFormatter={this.tooltipFormatter2D}
        legendLabels={getLegendLabelsForMultiSeries(
          this.props.columns,
          this.colorScale,
          this.props.numberColumnIndices
        )}
      />
    )
  }

  renderLineChart = () => (
    <ChataLineChart
      {...this.getCommonChartProps()}
      labelValue="label"
      tooltipFormatter={this.tooltipFormatter2D}
      legendLabels={getLegendLabelsForMultiSeries(
        this.props.columns,
        this.colorScale,
        this.props.numberColumnIndices
      )}
    />
  )

  renderPieChart = () => {
    const { stringColumnIndex, numberColumnIndex } = this.props

    return (
      <ChataPieChart
        {...this.getCommonChartProps()}
        labelValue="label"
        backgroundColor={this.props.backgroundColor}
        tooltipFormatter={d => {
          const { columns } = this.props
          const label = _get(d, `data.value.label`)
          const value = _get(d, 'value')

          if (!label || !value) {
            return null
          }

          try {
            const tooltipElement = `<div>
          <div>
            <strong>${
              columns[stringColumnIndex].title
            }:</strong> ${formatElement({
              element: label,
              column: columns[stringColumnIndex],
              config: this.props.dataFormatting
            })}
          </div>
          <div><strong>${
            columns[numberColumnIndex].title
          }:</strong> ${formatElement({
              element: value,
              column: columns[numberColumnIndex],
              config: this.props.dataFormatting
            })}
          </div>
        </div>`
            return tooltipElement
          } catch (error) {
            console.error(error)
            return null
          }
        }}
      />
    )
  }

  renderHeatmapChart = () => (
    <ChataHeatmapChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelX"
      labelValueY="labelY"
      tooltipFormatter={this.tooltipFormatter3D}
    />
  )

  renderBubbleChart = () => (
    <ChataBubbleChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelX"
      labelValueY="labelY"
      tooltipFormatter={this.tooltipFormatter3D}
    />
  )

  renderStackedColumnChart = () => (
    <ChataStackedColumnChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelX"
      labelValueY="labelY"
      tooltipFormatter={this.tooltipFormatter3D}
    />
  )

  renderStackedBarChart = () => (
    <ChataStackedBarChart
      {...this.getCommonChartProps()}
      dataValue="value"
      labelValueX="labelY"
      labelValueY="labelX"
      tooltipFormatter={this.tooltipFormatter3D}
    />
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
      case 'contrast_column': {
        chart = this.renderContrastColumnChart()
        break
      }
      case 'contrast_bar': {
        chart = this.renderContrastBarChart()
        break
      }
      case 'contrast_line': {
        chart = this.renderContrastLineChart()
        break
      }
      default: {
        chart = 'Unknown Display Type'
        break
      }
    }

    return (
      <div
        id={`chata-chart-${this.CHART_ID}`}
        className="chata-chart-container"
        data-test="chata-chart"
      >
        <svg
          ref={r => (this.chartRef = r)}
          xmlns="http://www.w3.org/2000/svg"
          width={this.props.width}
          height={this.props.height}
          style={{
            fontFamily: _get(
              this.props.themeConfig,
              'font-family',
              'sans-serif'
            ),
            color: _get(
              this.props.themeConfig,
              'text-color-primary',
              'inherit'
            ),
            background: _get(
              this.props.themeConfig,
              'background-color',
              'inherit'
            )
          }}
        >
          <g className="chata-chart-content-container">{chart}</g>
        </svg>
        {this.renderAxisSelectors()}
      </div>
    )
  }
}
