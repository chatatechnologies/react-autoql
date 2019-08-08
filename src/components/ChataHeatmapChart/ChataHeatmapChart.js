import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Axes } from '../Axes'
import { Squares } from '../Squares'
import { scaleBand } from 'd3-scale'
import { select } from 'd3-selection'
import { max, min } from 'd3-array'

export default class ChataHeatmapChart extends Component {
  xScale = scaleBand()
  yScale = scaleBand()

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

    console.log('max Y label width')
    console.log(maxYLabelWidth)

    const bottomMargin = Math.ceil(xAxisBBox.height) + 30 // margin to include axis label
    let leftMargin = Math.ceil(maxYLabelWidth) + 45 // margin to include axis label

    // If the rotated labels in the x axis exceed the width of the chart, use that instead
    if (xAxisBBox.width > this.props.width) {
      leftMargin =
        xAxisBBox.width - this.props.width + this.state.leftMargin + 45
    }

    console.log('bbox width')
    console.log(xAxisBBox.width)

    console.log('props width:')
    console.log(this.props.width)
    this.setState({
      leftMargin,
      bottomMargin
    })
  }

  onlyUnique = (value, index, self) => {
    return self.indexOf(value) === index
  }

  render = () => {
    const self = this
    const { data, width, height } = this.props
    const { leftMargin, rightMargin, bottomMargin, topMargin } = this.state

    // const maxValue = max(data, d => {
    //   return max(d[self.props.dataValue], el => el[self.props.labelValueX])
    // })
    const maxValue = max(data, d => d[self.props.dataValue])

    const uniqueXLabels = data
      .map(d => d[this.props.labelValueX])
      .filter(self.onlyUnique)
      .sort()
      .reverse() // sorts dates correctly

    const xScale = this.xScale
      .domain(uniqueXLabels)
      .range([width - rightMargin, leftMargin])
      .paddingInner(0)

    const uniqueYLabels = data
      .map(d => d[this.props.labelValueY])
      .filter(self.onlyUnique)
    const yScale = this.yScale
      .domain(uniqueYLabels)
      .range([height - bottomMargin, topMargin])
      .paddingInner(0)

    const squareHeight = height / uniqueYLabels.length
    const squareWidth = width / uniqueXLabels.length

    const intervalHeight = Math.ceil((uniqueYLabels.length * 14) / height)
    const intervalWidth = Math.ceil((uniqueXLabels.length * 14) / width)

    let xTickValues
    if (squareWidth < 14) {
      xTickValues = []
      uniqueXLabels.forEach((element, index) => {
        if (index % intervalWidth === 0) {
          xTickValues.push(element)
        }
      })
    }
    let yTickValues
    if (squareHeight < 14) {
      yTickValues = []
      uniqueYLabels.forEach((element, index) => {
        if (index % intervalHeight === 0) {
          yTickValues.push(element)
        }
      })
    }

    return (
      <div className="chata-chart-container">
        <svg ref={r => (this.chartRef = r)} width={width} height={height}>
          <Axes
            scales={{ xScale, yScale }}
            xCol={this.props.columns[1]}
            yCol={this.props.columns[0]}
            valueCol={this.props.columns[2]}
            margins={{
              left: leftMargin,
              right: rightMargin,
              bottom: bottomMargin,
              top: topMargin
            }}
            width={this.props.width}
            height={this.props.height}
            yTicks={yTickValues}
            xTicks={xTickValues}
            rotateLabels={squareWidth < 125}
          />
          {
            <Squares
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
              labelValueX={this.props.labelValueX}
              labelValueY={this.props.labelValueY}
              onDoubleClick={this.props.onDoubleClick}
              tooltipFormatter={this.props.tooltipFormatter}
            />
          }
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
