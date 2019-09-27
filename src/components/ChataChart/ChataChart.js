import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'

import { select } from 'd3-selection'
import { max } from 'd3-array'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'

import { svgToPng, formatElement } from '../../js/Util.js'

import styles from './ChataChart.css'

export default class ChataChart extends Component {
  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    type: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired
  }

  static defaultProps = {}

  state = {
    leftMargin: 50,
    rightMargin: 10,
    topMargin: 10,
    bottomMargin: 100
  }

  componentDidMount = () => {
    this.updateMargins()
  }

  componentDidUpdate = prevProps => {
    if (this.props.type && this.props.type !== prevProps.type) {
      this.updateMargins()
      ReactTooltip.rebuild()
    }
  }

  updateMargins = () => {
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

    let bottomMargin = Math.ceil(xAxisBBox.height) + 30 // margin to include axis label

    if (this.props.type === 'bar') {
      // only for bar charts (vertical grid lines mess with the axis size)
      const innerTickSize =
        this.props.height - this.state.topMargin - this.state.bottomMargin
      bottomMargin = bottomMargin - innerTickSize
    }

    let leftMargin = Math.ceil(maxYLabelWidth) + 45 // margin to include axis label
    // If the rotated labels in the x axis exceed the width of the chart, use that instead
    if (xAxisBBox.width > this.props.width) {
      leftMargin =
        xAxisBBox.width - this.props.width + this.state.leftMargin + 45
    }

    this.setState({
      leftMargin,
      bottomMargin
    })
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
      labelCol
    )}
      </div>
      <div><strong>${valueCols[colIndex].title}:</strong> ${formatElement(
      data.values[colIndex],
      valueCols[colIndex]
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
      labelColY
    )}
    </div>
    <div>
      <strong>${labelColX.title}:</strong> ${formatElement(
      data.labelX,
      labelColX
    )}
    </div>
    <div>
      <strong>${valueCol.title}:</strong> ${formatElement(data.value, valueCol)}
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
      />
    )
  }

  renderStackedColumnChart = () => {
    return null
  }

  renderStackedBarChart = () => {
    return null
  }

  renderContrastColumnChart = () => {
    return null
  }

  renderContrastBarChart = () => {
    return null
  }

  renderContrastLineChart = () => {
    return null
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
      <Fragment>
        <style>{`${styles}`}</style>
        <div className="chata-chart-container">
          <svg
            ref={r => (this.chartRef = r)}
            xmlns="http://www.w3.org/2000/svg"
            width={this.props.width}
            height={this.props.height}
            style={{
              fontFamily: 'sans-serif',
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
