import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'
import { ChataHeatmapChart } from '../ChataHeatmapChart'
import { ChataBubbleChart } from '../ChataBubbleChart'

import { svgToPng } from '../../js/Util.js'

import styles from './ChataChart.css'

export default class ChataChart extends Component {
  X_AXIS_INDICES = []
  Y_AXIS_INDICES = []
  Z_AXIS_INDEX = null

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    valueFormatter: PropTypes.func.isRequired,
    type: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired
  }

  static defaultProps = {}

  state = {}

  componentWillMount = () => {
    const { type } = this.props
    // Set index of columns and data that correspond to each axis
    if (type === 'column' || type === 'line') {
      this.X_AXIS_INDICES = [0]
      this.Y_AXIS_INDICES = [1]
    } else if (type === 'bar') {
      this.X_AXIS_INDICES = [1]
      this.Y_AXIS_INDICES = [0]
    } else if (type === 'pie') {
    } else if (type === 'contrast_column' || type === 'contrast_line') {
      this.X_AXIS_INDICES = [0]
      this.Y_AXIS_INDICES = [1, 2]
    } else if (type === 'contrast_bar') {
      this.X_AXIS_INDICES = [1, 2]
      this.Y_AXIS_INDICES = [0]
    } else if (type === 'word_cloud') {
    } else if (type === 'heatmap' || type === 'bubble') {
      this.X_AXIS_INDICES = [1]
      this.Y_AXIS_INDICES = [0]
      this.Z_AXIS_INDEX = 2
    }
  }

  tooltipFormatter2Columns = data => {
    if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
      return null
    }

    const { columns, valueFormatter } = this.props
    const xCol = columns[this.X_AXIS_INDICES[0]]
    const yCol = columns[this.Y_AXIS_INDICES[0]]

    return `<div>
      <div>
        <strong>${xCol.title}:</strong> ${valueFormatter(data.label, xCol)}
      </div>
      <div><strong>${yCol.title}:</strong> ${valueFormatter(data.value, yCol)}
      </div>
    </div>`
  }

  tooltipFormatter3Columns = data => {
    if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
      return null
    }

    const { columns, valueFormatter } = this.props
    const xCol = columns[this.X_AXIS_INDICES[0]]
    const yCol = columns[this.Y_AXIS_INDICES[0]]
    const zCol = columns[this.Z_AXIS_INDEX]

    return `<div>
    <div>
      <strong>${xCol.title}:</strong> ${valueFormatter(data.labelX, xCol)}
    </div>
    <div>
      <strong>${yCol.title}:</strong> ${valueFormatter(data.labelY, yCol)}
    </div>
    <div>
      <strong>${zCol.title}:</strong> ${valueFormatter(data.value, zCol)}
    </div>
  </div>`
  }

  saveAsPNG = () => {
    const svgElement = this.chartRef && this.chartRef.chartRef
    if (!svgElement) {
      return
    }

    svgToPng(svgElement)
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
      .catch(err => {
        console.log(err)
      })
  }

  renderColumnChart = () => {
    const self = this
    return (
      <ChataColumnChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2Columns}
      />
    )
  }

  renderBarChart = () => {
    const self = this
    return (
      <ChataBarChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2Columns}
      />
    )
  }

  renderLineChart = () => {
    const self = this
    return (
      <ChataLineChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2Columns}
      />
    )
  }

  renderPieChart = () => {
    const self = this
    return (
      <ChataPieChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={self.tooltipFormatter2Columns}
      />
    )
  }

  renderHeatmapChart = () => {
    const self = this
    return (
      <ChataHeatmapChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValueX="labelX"
        labelValueY="labelY"
        tooltipFormatter={self.tooltipFormatter3Columns}
      />
    )
  }

  renderBubbleChart = () => {
    const self = this
    return (
      <ChataBubbleChart
        ref={ref => (this.chartRef = ref)}
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValueX="labelX"
        labelValueY="labelY"
        tooltipFormatter={self.tooltipFormatter3Columns}
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
        {chart}
      </Fragment>
    )
  }
}
