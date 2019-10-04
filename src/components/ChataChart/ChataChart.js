import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import uuid from 'uuid'

import { select } from 'd3-selection'
import { max } from 'd3-array'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'
import { ChataStackedBarChart } from '../ChataStackedBarChart'
import { ChataStackedColumnChart } from '../ChataStackedColumnChart'

import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { svgToPng, formatElement } from '../../js/Util.js'

import styles from './ChataChart.css'

export default class ChataChart extends Component {
  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    type: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    currencyCode: PropTypes.string
  }

  static defaultProps = {
    currencyCode: undefined,
    languageCode: undefined
  }

  state = {
    leftMargin: 50,
    rightMargin: 10,
    topMargin: 10,
    bottomMargin: 100
  }

  componentDidMount = () => {
    this.CHART_ID = uuid.v4()
    this.updateMargins()
  }

  componentDidUpdate = prevProps => {
    if (this.props.type && this.props.type !== prevProps.type) {
      this.updateMargins()
      ReactTooltip.rebuild()
    }
  }

  updateMargins = () => {
    try {
      const xAxisBBox = select(this.chartRef)
        .select('.axis-Bottom')
        .node()
        .getBBox()

      const yAxisLabels = select(this.chartRef)
        .select('.axis-Left')
        .selectAll('text')

      const maxYLabelWidth = max(yAxisLabels.nodes(), n =>
        n.getComputedTextLength()
      )

      // Space for legend
      let rightMargin = this.state.rightMargin
      if (
        this.props.type === 'stacked_bar' ||
        this.props.type === 'stacked_column'
      ) {
        rightMargin = 150
      }

      let bottomMargin = Math.ceil(xAxisBBox.height) + 30 // margin to include axis label

      if (this.props.type === 'bar' || this.props.type === 'stacked_bar') {
        // only for bar charts (vertical grid lines mess with the axis size)
        const innerTickSize =
          this.props.height - this.state.topMargin - this.state.bottomMargin
        bottomMargin = bottomMargin - innerTickSize + 10
      }

      let leftMargin = Math.ceil(maxYLabelWidth) + 45 // margin to include axis label
      // If the rotated labels in the x axis exceed the width of the chart, use that instead
      if (xAxisBBox.width > this.props.width) {
        leftMargin =
          xAxisBBox.width - this.props.width + this.state.leftMargin + 45
      }

      this.setState({
        leftMargin,
        bottomMargin,
        rightMargin
      })
    } catch (error) {
      // Something went wrong rendering the chart.
      console.log(error)
    }
  }

  tooltipFormatter2D = (data, colIndex) => {
    const { columns } = this.props
    const labelCol = columns[0]
    const valueCols = columns.slice(1) // Supports multi-series

    if (!labelCol || !valueCols || !(colIndex >= 0)) {
      return null
    }

    return `<div>
      <div>
        <strong>${labelCol.title}:</strong> ${formatElement(
      data.label,
      labelCol,
      this.props.currencyCode,
      this.props.languageCode
    )}
      </div>
      <div><strong>${valueCols[colIndex].title}:</strong> ${formatElement(
      data.values[colIndex],
      valueCols[colIndex],
      this.props.currencyCode,
      this.props.languageCode
    )}
      </div>
    </div>`
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
      <strong>${labelColY.title}:</strong> ${formatElement(
      data.labelY,
      labelColY,
      this.props.currencyCode,
      this.props.languageCode
    )}
    </div>
    <div>
      <strong>${labelColX.title}:</strong> ${formatElement(
      data.labelX,
      labelColX,
      this.props.currencyCode,
      this.props.languageCode
    )}
    </div>
    <div>
      <strong>${valueCol.title}:</strong> ${formatElement(
      data.value,
      valueCol,
      this.props.currencyCode,
      this.props.languageCode
    )}
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
      .catch(err => {})
  }

  renderColumnChart = () => {
    const self = this
    return (
      <ChataColumnChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="values"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderBarChart = () => {
    const self = this
    return (
      <ChataBarChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValues="values"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderLineChart = () => {
    const self = this
    return (
      <ChataLineChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValues="values"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderPieChart = () => {
    const self = this
    return (
      <ChataPieChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderHeatmapChart = () => {
    const self = this
    return (
      <ChataHeatmapChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="value"
        labelValueX="labelX"
        labelValueY="labelY"
        tooltipFormatter={self.tooltipFormatter3D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderBubbleChart = () => {
    const self = this
    return (
      <ChataBubbleChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="value"
        labelValueX="labelX"
        labelValueY="labelY"
        tooltipFormatter={self.tooltipFormatter3D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderStackedColumnChart = () => {
    const self = this
    return (
      <ChataStackedColumnChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="value"
        labelValueX="labelY"
        labelValueY="labelX"
        tooltipFormatter={self.tooltipFormatter3D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

  renderStackedBarChart = () => {
    const self = this
    return (
      <ChataStackedBarChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        topMargin={this.state.topMargin}
        bottomMargin={this.state.bottomMargin}
        rightMargin={this.state.rightMargin}
        leftMargin={this.state.leftMargin}
        onChartClick={this.props.onChartClick}
        dataValue="value"
        labelValueX="labelY"
        labelValueY="labelX"
        tooltipFormatter={self.tooltipFormatter3D}
        currencyCode={this.props.currencyCode}
        languageCode={this.props.languageCode}
      />
    )
  }

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
      <Fragment>
        <style>{`${styles}`}</style>
        <div className="chata-chart-container">
          <svg
            ref={r => (this.chartRef = r)}
            xmlns="http://www.w3.org/2000/svg"
            width={this.props.width}
            height={this.props.height}
            style={{
              fontFamily: 'inherit',
              background: 'inherit'
            }}
          >
            {chart}
          </svg>
        </div>
      </Fragment>
    )
  }
}
