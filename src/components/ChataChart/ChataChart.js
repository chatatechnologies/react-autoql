import React, { Component } from 'react'
import PropTypes from 'prop-types'

import { ChataBarChartNew } from '../ChataBarChartNew'

export default class ChataChart extends Component {
  DIMENSION = null

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

  componentDidMount = () => {
    // Is it 2d or 3d data?
    // const { columns } = this.props
    // this.DIMENSION = columns.length
  }

  renderColumnChart = () => {
    const self = this
    return (
      <ChataBarChartNew
        data={this.props.data}
        columns={this.props.columns}
        height={this.props.height}
        width={this.props.width}
        dataValue="yValue"
        labelValue="xValue"
        tooltipFormatter={data => {
          return `<div>
              <span><strong>${self.props.columns[0].title}:</strong> ${
            data.xValue
          }</span>
              <br />
              <span><strong>${
                self.props.columns[1].title
              }:</strong> ${self.props.valueFormatter(data.yValue)}</span>
            </div>`
        }}
      />
    )
  }

  renderBarChart = () => {
    return null
  }

  renderLineChart = () => {
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
    }
  }
}
