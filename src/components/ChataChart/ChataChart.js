import React, { Component } from 'react'
import PropTypes from 'prop-types'

import { ChataColumnChart } from '../ChataColumnChart'
import { ChataBarChart } from '../ChataBarChart'
import { ChataLineChart } from '../ChataLineChart'
import { ChataPieChart } from '../ChataPieChart'

import styles from './ChataChart.css'

export default class ChataChart extends Component {
  X_AXIS_INDICES = []
  Y_AXIS_INDICES = []

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
    }

    // Find longest xaxis label and longest yaxis label
    // This will be used to create left and bottom margins
  }

  renderColumnChart = () => {
    const self = this
    return (
      <ChataColumnChart
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={data => {
          if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
            return null
          }
          return `<div>
            <div>
              <strong>${
                self.props.columns[this.X_AXIS_INDICES[0]].title
              }:</strong> ${data.label}
            </div>
            <div><strong>${
              self.props.columns[this.Y_AXIS_INDICES[0]].title
            }:</strong> ${self.props.valueFormatter(data.value)}
            </div>
          </div>`
        }}
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
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={data => {
          if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
            return null
          }
          return `<div>
            <div>
              <strong>${
                self.props.columns[this.Y_AXIS_INDICES[0]].title
              }:</strong> ${data.label}
            </div>
            <div><strong>${
              self.props.columns[this.X_AXIS_INDICES[0]].title
            }:</strong> ${self.props.valueFormatter(data.value)}
            </div>
          </div>`
        }}
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
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={data => {
          if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
            return null
          }
          return `<div>
          <div>
            <strong>${
              self.props.columns[this.X_AXIS_INDICES[0]].title
            }:</strong> ${data.label}
          </div>
          <div><strong>${
            self.props.columns[this.Y_AXIS_INDICES[0]].title
          }:</strong> ${self.props.valueFormatter(data.value)}
          </div>
        </div>`
        }}
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
        onDoubleClick={this.props.onDoubleClick}
        dataValue="value"
        labelValue="label"
        tooltipFormatter={data => {
          if (!this.X_AXIS_INDICES.length || !this.Y_AXIS_INDICES.length) {
            return null
          }
          return `<div>
          <div>
            <strong>${
              self.props.columns[this.X_AXIS_INDICES[0]].title
            }:</strong> ${data.label}
          </div>
          <div><strong>${
            self.props.columns[this.Y_AXIS_INDICES[0]].title
          }:</strong> ${self.props.valueFormatter(data.value)}
          </div>
        </div>`
        }}
      />
    )
  }

  renderBubbleChart = () => {
    return null
  }

  renderHeatmapChart = () => {
    return null
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
      case 'contrast_column': {
        return this.renderContrastColumnChart()
      }
      case 'contrast_bar': {
        return this.renderContrastBarChart()
      }
      case 'contrast_line': {
        return this.renderContrastLineChart()
      }
      default: {
        return 'Unknown Display Type'
      }
    }
  }
}
