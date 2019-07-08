import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import uuid from 'uuid'
import { scaleLinear, scaleOrdinal, scaleBand, rangeRound } from 'd3-scale'
import { axisLeft, axisBottom } from 'd3-axis'
import { max, range, extent } from 'd3-array'
import { select, selectAll, event } from 'd3-selection'
import d3Tip from 'd3-tip'
// import 'd3-transition'
import { transition } from 'd3-transition'
// import { transition } from 'd3-transition'

import styles from './ChatabarChart.css'

export default class ChataBarChart extends Component {
  // dataArray = []
  static propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    type: PropTypes.string, // bar or column
    margin: PropTypes.shape({}),
    dataValue: PropTypes.string,
    tooltipFormatter: PropTypes.func,
    size: PropTypes.arrayOf(PropTypes.number)
  }

  static defaultProps = {
    type: 'column',
    margin: { left: 25, right: 25, top: 25, bottom: 50 },
    dataValue: 'value',
    labelValue: 'label',
    tooltipFormatter: undefined
  }

  state = {
    margin: this.props.margin,
    activeBar: null
  }

  componentDidMount = () => {
    // this.chartKey = `chata-bar-chart-${uuid.v4()}`
    this.createBarChart()
  }

  componentDidUpdate = () => {
    // this.createBarChart()
  }

  createBarChart = () => {
    const self = this
    const node = this.node
    const { data } = this.props
    const { margin } = this.state
    const width = this.props.size[0] - margin.left - margin.right
    const height = this.props.size[1] - margin.top - margin.bottom

    console.log('height:')
    console.log(height)

    // const yScale = scaleLinear().range([height, 0]).domain()
    const yScale = scaleLinear()

    console.log('y scale')
    console.log(yScale)

    const xScale = scaleBand()
      .rangeRound([0, width - margin.left - margin.right])
      .paddingInner(0.1) // space between bars

    const X = d => xScale(d[self.props.labelValue])
    const Y0 = () => yScale(0)
    const Y = d => yScale(d[self.props.dataValue])

    const yAxis = axisLeft()
      .scale(yScale)
      .ticks(6)
      .tickSizeOuter(0)
      .tickSizeInner(-width + margin.left + margin.right)

    const xAxis = axisBottom()
      .scale(xScale)
      .tickSizeOuter(0)

    const barWidth = width / data.length
    const interval = Math.ceil((data.length * 30) / width)
    if (barWidth < 30) {
      let tickValues = []
      data.forEach((element, index) => {
        if (index % interval === 0) {
          tickValues.push(element[self.props.labelValue])
        }
      })
      xAxis.tickValues(tickValues)
    }

    // initialize svg
    const svg = select(node)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('border', '1px solid red')
      // .attr('width', width)
      // .attr('height', height)
      // .attr('viewBox', '0 0 ' + Math.min(100, 200) + ' ' + Math.min(200, 400))
      // .attr('preserveAspectRatio', 'xMinYMin')
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // append axes
    xScale.domain(data.map(d => d[self.props.labelValue]))
    yScale
      .domain(extent(data.map(d => d[self.props.dataValue])))
      .range([height - margin.top - margin.bottom, 0])
    // .nice()

    console.log('y axis:')
    console.log(yAxis)

    svg
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
    if (barWidth < 100) {
      svg
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
    }

    svg
      .append('g')
      .attr('class', 'y axis')
      .call(yAxis)

    const tooltip = d3Tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(d => {
        if (self.props.tooltipFormatter) {
          return self.props.tooltipFormatter(d)
        }
        return d[self.props.dataValue]
      })

    svg.call(tooltip)

    // add bars
    svg
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', function(d, i) {
        return d[self.props.dataValue] < 0 ? 'bar negative' : 'bar positive'
      })
      .attr('x', d => xScale(d[self.props.labelValue]))
      .attr('width', xScale.bandwidth())
      // .attr('y', d => yScale(d[self.props.dataValue]) + 1) // removes gap between bar and x axis
      .attr('y', function(d, i) {
        return d[self.props.dataValue] < 0 ? Y0() : Y(d)
      })
      // .attr('height', d => height - yScale(d[self.props.dataValue]))
      .attr('height', function(d, i) {
        return Math.abs(Y(d) - Y0())
      })
      .on('mouseover', function(d, i, e) {
        const x = event.x
        const y = event.y
        tooltip.show(d, e[i])
        tooltip.style('top', y)
        tooltip.style('left', x)
      })
      .on('mouseout', tooltip.hide)
      .on('click', (d, i, e) => {
        selectAll('rect') //<-- or slap a class name on the bars and use that
          .style('fill', '#339CFF')

        select(event.target).style('fill', '#A5CD39')
        this.setState({ activeBar: d[self.props.labelValue] })
      })
  }

  render = () => {
    return (
      <div className="chata-bar-chart-container">
        <style>{`${styles}`}</style>
        {
          // <svg
          //   ref={node => (this.node = node)}
          //   width={this.props.size[0]}
          //   height={this.props.size[1]}
          // />
        }
        <div ref={node => (this.node = node)} />
      </div>
    )
  }
}
