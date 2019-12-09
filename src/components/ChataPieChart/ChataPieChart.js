import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import Numbro from 'numbro'
import _get from 'lodash.get'
import uuid from 'uuid'
import ReactTooltip from 'react-tooltip'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc, symbol, symbolCircle } from 'd3-shape'
import { entries } from 'd3-collection'
import { legendColor } from 'd3-svg-legend'
import 'd3-transition'

import { formatElement } from '../../js/Util'

export default class Axis extends Component {
  CHART_ID = uuid.v4()

  static propTypes = {
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    data: PropTypes.arrayOf(PropTypes.shape()).isRequired,
    onChartClick: PropTypes.func,
    margin: PropTypes.number,
    backgroundColor: PropTypes.string,
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
    margin: 20,
    backgroundColor: 'transparent',
    dataFormatting: {},
    onChartClick: () => {}
  }

  state = {
    activeKey: this.props.activeChartElementKey
  }

  componentDidMount = () => {
    this.renderPie()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.state.activeKey !== nextState.activeKey) {
      return true
    }

    if (
      this.props.height !== nextProps.height ||
      this.props.width !== nextProps.width
    ) {
      return true
    }

    return false
  }

  componentDidUpdate = () => {
    this.renderPie()
    ReactTooltip.rebuild()
  }

  renderPieContainer = () => {
    const { width, height } = this.props
    if (this.pieChartContainer) {
      // Remove previous pie slices
      this.pieChartContainer.remove()
    }

    this.pieChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'slices')
      .attr(
        'transform',
        `translate(${width / 2 + this.outerRadius},${height / 2})`
      )
  }

  setColorScale = () => {
    const self = this

    this.color = scaleOrdinal()
      .domain(
        self.sortedData.map(d => {
          return d[self.props.labelValue]
        })
      )
      .range(this.props.chartColors)

    const pieChart = pie().value(d => {
      return d.value[self.props.dataValue]
    })

    this.dataReady = pieChart(entries(self.sortedData))
  }

  renderPieSlices = () => {
    const self = this

    // build the pie chart
    this.pieChartContainer
      .selectAll('.slices')
      .data(self.dataReady)
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr(
        'd',
        arc()
          .innerRadius(self.innerRadius)
          .outerRadius(self.outerRadius)
      )
      .attr('fill', d => {
        return self.color(d.data.value[self.props.labelValue])
      })
      .attr('data-for', 'chart-element-tooltip')
      .attr('data-tip', function(d) {
        return self.props.tooltipFormatter(d)
      })
      .style('fill-opacity', 0.85)
      .attr('stroke-width', '0.5px')
      .attr('stroke', this.props.backgroundColor)
      .on('mouseover', function(d) {
        select(this).style('fill-opacity', 1)
      })
      .on('mouseout', function(d) {
        select(this).style('fill-opacity', 0.85)
      })
      .on('click', function(d) {
        if (d.data.value[self.props.labelValue] === self.state.activeKey) {
          // Put it back if it is expanded
          self.setState({ activeKey: null })
        } else {
          self.props.onChartClick({
            row: _get(d, 'data.value.origRow', []),
            activeKey: d.data.value[self.props.labelValue]
          })
          self.setState({ activeKey: d.data.value[self.props.labelValue] })
        }
      })

    // render active pie slice if there is one
    self.pieChartContainer.selectAll('path.slice').each(function(slice) {
      select(this)
        .transition()
        .duration(500)
        .attr('transform', function(data) {
          if (data.data.value[self.props.labelValue] === self.state.activeKey) {
            const a =
              data.startAngle +
              (data.endAngle - data.startAngle) / 2 -
              Math.PI / 2
            const x = Math.cos(a) * 10
            const y = Math.sin(a) * 10
            // move it away from the circle center
            return 'translate(' + x + ',' + y + ')'
          }
        })
    })
  }

  centerVisualization = () => {
    const containerBBox = select(`#pie-chart-container-${this.CHART_ID}`)
      .node()
      .getBBox()

    const containerWidth = containerBBox.width
    const currentXPosition = containerBBox.x
    const finalXPosition = (this.props.width - containerWidth) / 2
    const xDelta = finalXPosition - currentXPosition

    select(`#pie-chart-container-${this.CHART_ID}`).attr(
      'transform',
      `translate(${xDelta},0)`
    )
  }

  renderLegend = () => {
    const self = this
    const { height, margin, labelValue, dataValue, chartColors } = this.props

    const legendLabels = this.sortedData.map(d => {
      const legendString = `${formatElement({
        element: d[labelValue] || 'Untitled Category',
        column: _get(d, 'origColumns[0]')
      })}: ${formatElement({
        element: d[dataValue][0] || 0,
        column: _get(d, 'origColumns[1]'),
        config: this.props.dataFormatting
      })}`
      return legendString.trim()
    })

    let legendScale
    if (legendLabels) {
      legendScale = scaleOrdinal()
        .domain(legendLabels)
        .range(chartColors)
    } else {
      return
    }

    // The legend wrap length threshold should be half of the width
    // Because the pie will never be larger than half the width
    const legendWrapLength = this.props.width / 2 - 50 // 30 for the width of the circles and padding

    const svg = select(this.legendElement)
    svg
      .append('g')
      .attr('class', 'legendOrdinal')
      .style('fill', 'currentColor')
      .style('fill-opacity', '0.7')
      .style('font-family', 'inherit')
      .style('font-size', '10px')
    var legendOrdinal = legendColor()
      .shape(
        'path',
        symbol()
          .type(symbolCircle)
          .size(75)()
      )
      .orient('vertical')
      .shapePadding(5)
      .labelWrap(legendWrapLength)
      .scale(legendScale)

    svg.select('.legendOrdinal').call(legendOrdinal)

    const legendBBox = svg
      .select('.legendOrdinal')
      .node()
      .getBBox()

    const legendHeight = legendBBox.height
    const legendWidth = legendBBox.width
    const legendXPosition = this.props.width / 2 - legendWidth - 20
    const legendYPosition =
      legendHeight < height - 20 ? (height - legendHeight) / 2 : 15

    svg
      .select('.legendOrdinal')
      .attr('transform', `translate(${legendXPosition}, ${legendYPosition})`)
  }

  setPieRadius = () => {
    const { width, height, margin } = this.props

    let pieWidth
    if (width < height) {
      pieWidth = width / 2 - margin
    } else if (height * 2 < width) {
      pieWidth = height - margin
    } else {
      pieWidth = width / 2 - margin
    }

    this.outerRadius = pieWidth / 2
    this.innerRadius = this.outerRadius - 40 > 15 ? this.outerRadius - 40 : 0
  }

  renderPie = () => {
    const self = this
    const { data } = this.props

    this.setPieRadius()

    this.outerArc = arc()
      .innerRadius(self.outerRadius * 1.1)
      .outerRadius(self.outerRadius * 1.1)

    this.sortedData = data
      .concat() // this copies the array so the original isn't mutated
      .sort(
        (a, b) =>
          parseFloat(a[self.props.dataValue]) -
          parseFloat(b[self.props.dataValue])
      )

    this.renderPieContainer()
    this.setColorScale()
    this.renderPieSlices()
    this.renderLegend()

    // Finally, translate container of legend and pie chart to center of parent container
    this.centerVisualization()
  }

  render = () => {
    return (
      <g id={`pie-chart-container-${this.CHART_ID}`}>
        <svg
          className="pie-chart"
          ref={el => {
            this.chartElement = el
          }}
          width={this.props.width}
          height={this.props.height}
        />
        <g
          ref={el => {
            this.legendElement = el
          }}
          className="legendOrdinal-container"
        />
      </g>
    )
  }
}
