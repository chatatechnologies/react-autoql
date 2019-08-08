import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Axes } from '../Axes'
import { Line } from '../Line'
import { scaleLinear, scaleBand } from 'd3-scale'
import { select } from 'd3-selection'
import { max, min } from 'd3-array'

export default class ChataLineChart extends Component {
  xScale = scaleBand()
  yScale = scaleLinear()

  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    margin: PropTypes.shape({}),
    dataValue: PropTypes.string,
    labelValue: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    size: PropTypes.arrayOf(PropTypes.number),
    width: PropTypes.number,
    height: PropTypes.number
  }

  static defaultProps = {
    margins: { left: 50, right: 10, top: 10, bottom: 100 },
    dataValue: 'value',
    labelValue: 'label',
    tooltipFormatter: () => {}
  }

  state = {
    leftMargin: this.props.margins.left,
    rightMargin: this.props.margins.right,
    topMargin: this.props.margins.top,
    bottomMargin: this.props.margins.bottom
  }

  componentDidMount = () => {
    this.updateMargins()
  }

  componentDidUpdate = () => {}

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

    const bottomMargin = Math.ceil(xAxisBBox.height) + 30 // margin to include axis label
    let leftMargin = Math.ceil(maxYLabelWidth) + 45 // margin to include axis label

    // If the rotated labels in the x axis exceed the width of the chart, use that instead
    if (xAxisBBox.width > this.props.width) {
      leftMargin =
        xAxisBBox.width - this.props.width + this.state.leftMargin + 45
    }

    this.setState({
      leftMargin: leftMargin,
      bottomMargin: bottomMargin
    })
  }

  render = () => {
    const self = this
    const { data, width, height } = this.props
    const { leftMargin, rightMargin, bottomMargin, topMargin } = this.state

    const maxValue = max(data, d => d[self.props.dataValue])
    let minValue = min(data, d => d[self.props.dataValue])
    // Make sure 0 is always visible on the y axis
    if (minValue > 0) {
      minValue = 0
    }

    const xScale = this.xScale
      .domain(data.map(d => d[this.props.labelValue]))
      .range([leftMargin, width - rightMargin])
      .paddingInner(0.1)

    const yScale = this.yScale
      .domain([minValue, maxValue])
      .range([height - bottomMargin, topMargin])

    const barWidth = width / data.length
    const interval = Math.ceil((data.length * 16) / width)
    let xTickValues
    if (barWidth < 16) {
      xTickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          xTickValues.push(element[self.props.labelValue])
        }
      })
    }

    return (
      <div className="chata-chart-container">
        <svg ref={r => (this.chartRef = r)} width={width} height={height}>
          <Axes
            // data={this.props.data}
            scales={{ xScale, yScale }}
            xCol={this.props.columns[0]}
            yCol={this.props.columns[1]}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            width={this.props.width}
            height={this.props.height}
            xTicks={xTickValues}
            rotateLabels={barWidth < 125}
            yGridLines
          />
          <Line
            scales={{ xScale, yScale }}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            data={data}
            maxValue={maxValue}
            width={this.props.width}
            height={this.props.height}
            dataValue={this.props.dataValue}
            labelValue={this.props.labelValue}
            onDoubleClick={this.props.onDoubleClick}
            tooltipFormatter={this.props.tooltipFormatter}
          />
        </svg>
        <ReactTooltip
          className="chata-chart-tooltip"
          id="chart-element-tooltip"
          effect="solid"
          html
        />
      </div>
    )
  }
}
