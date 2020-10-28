import React, { Component, Fragment } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import uuid from 'uuid'
import ReactTooltip from 'react-tooltip'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc, symbol, symbolCircle } from 'd3-shape'
import { entries } from 'd3-collection'
import { legendColor } from 'd3-svg-legend'
import 'd3-transition'

import { formatElement } from '../../../js/Util'
import { themeConfigType, dataFormattingType } from '../../../props/types'
import {
  themeConfigDefault,
  dataFormattingDefault,
} from '../../../props/defaults'

export default class Axis extends Component {
  CHART_ID = uuid.v4()

  static propTypes = {
    themeConfig: themeConfigType,
    dataFormatting: dataFormattingType,

    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    data: PropTypes.arrayOf(PropTypes.shape()).isRequired,
    columns: PropTypes.arrayOf(PropTypes.shape()).isRequired,
    onChartClick: PropTypes.func,
    margin: PropTypes.number,
    backgroundColor: PropTypes.string,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    dataFormatting: dataFormattingDefault,

    margin: 40,
    backgroundColor: 'transparent',
    onChartClick: () => {},
  }

  state = {
    activeKey: this.props.activeChartElementKey,
  }

  componentDidMount = () => {
    this.LEGEND_ID = `react-autoql-pie-legend-${uuid.v4()}`
    this.renderPie()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (!_isEqual(this.props.data, nextProps.data)) {
      return true
    }

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
    const { chartColors } = this.props.themeConfig

    this.color = scaleOrdinal()
      .domain(
        self.sortedData.map((d) => {
          return d[self.props.labelValue]
        })
      )
      .range(chartColors)

    const pieChart = pie().value((d) => {
      return d.value.cells[0].value
    })

    this.dataReady = pieChart(entries(self.sortedData.filter((d) => !d.hidden)))
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
      .attr('fill', (d) => {
        return self.color(d.data.value[self.props.labelValue])
      })
      .attr('data-for', 'chart-element-tooltip')
      .attr('data-tip', function(d) {
        return _get(d, 'data.value.cells[0].tooltipData')
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
        const newActiveKey = _get(d, `data.value[${self.props.labelValue}]`)
        if (newActiveKey === self.state.activeKey) {
          // Put it back if it is expanded
          self.setState({ activeKey: null })
        } else {
          self.props.onChartClick({
            drilldownData: _get(d, 'data.value.cells[0].drilldownData'),
            activeKey: newActiveKey,
          })
          self.setState({ activeKey: newActiveKey })
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
    const containerElement = select(
      `#pie-chart-container-${this.CHART_ID}`
    ).node()

    let containerBBox
    if (containerElement) {
      containerBBox = containerElement.getBBox()
    }

    const containerWidth = _get(containerBBox, 'width', 0)
    const currentXPosition = _get(containerBBox, 'x', 0)
    const finalXPosition = (this.props.width - containerWidth) / 2
    const xDelta = finalXPosition - currentXPosition

    select(`#pie-chart-container-${this.CHART_ID}`).attr(
      'transform',
      `translate(${xDelta},0)`
    )
  }

  renderLegend = () => {
    const self = this
    const {
      height,
      margin,
      labelValue,
      stringColumnIndex,
      numberColumnIndex,
    } = this.props
    const { chartColors } = this.props.themeConfig

    this.legendLabels = this.sortedData.map((d) => {
      const legendString = `${formatElement({
        element: d[labelValue] || 'Untitled Category',
        column: _get(this.props, `columns[${stringColumnIndex}]`),
      })}: ${formatElement({
        element: d.cells[0].value || 0,
        column: _get(this.props, `columns[${numberColumnIndex}]`),
        config: this.props.dataFormatting,
      })}`
      return {
        hidden: d.hidden,
        label: legendString.trim(),
      }
    })

    let legendScale
    if (this.legendLabels) {
      legendScale = scaleOrdinal()
        .domain(self.legendLabels.map((item) => item.label))
        .range(chartColors)
    } else {
      return
    }

    // The legend wrap length threshold should be half of the width
    // Because the pie will never be larger than half the width
    const legendWrapLength = this.props.width / 2 - 70 // 70 for the width of the circles and padding

    const svg = select(this.legendElement)
    svg
      .append('g')
      .attr('class', 'legendOrdinal')
      .style('fill', 'currentColor')
      .style('fill-opacity', '0.7')
      .style('font-family', 'inherit')
      .style('font-size', '10px')
      .style('stroke-width', '2px')
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
      .on('cellclick', function(d) {
        const dataIndex = self.legendLabels.findIndex((legendObj) => {
          return legendObj.label === d
        })

        if (dataIndex >= 0) {
          self.props.onLegendClick(self.sortedData[dataIndex])
        }
      })

    svg.select('.legendOrdinal').call(legendOrdinal)

    let legendBBox
    const legendElement = svg.select('.legendOrdinal').node()
    if (legendElement) {
      legendBBox = legendElement.getBBox()
    }

    const legendHeight = _get(legendBBox, 'height', 0)
    const legendWidth = _get(legendBBox, 'width', 0)
    const legendXPosition = this.props.width / 2 - legendWidth - 20
    const legendYPosition =
      legendHeight < height - 20 ? (height - legendHeight) / 2 : 15

    svg
      .select('.legendOrdinal')
      .attr('transform', `translate(${legendXPosition}, ${legendYPosition})`)

    this.applyStylesForHiddenSeries()
  }

  applyStylesForHiddenSeries = () => {
    const legendLabelTexts = this.legendLabels
      .filter((l) => l.hidden)
      .map((l) => l.label)

    const legendSwatchElements = document.querySelectorAll(
      `#${this.LEGEND_ID} .label tspan`
    )

    if (legendSwatchElements) {
      legendSwatchElements.forEach((el) => {
        const swatchElement = el.parentElement.parentElement.querySelector(
          '.swatch'
        )
        swatchElement.style.strokeWidth = '2px'

        if (legendLabelTexts.includes(el.textContent)) {
          swatchElement.style.opacity = 0.3
        } else {
          swatchElement.style.opacity = 1
        }
      })
    }
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
    this.innerRadius = this.outerRadius - 50 > 15 ? this.outerRadius - 50 : 0
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
        (a, b) => parseFloat(a.cells[0].value) - parseFloat(b.cells[0].value)
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
      <g
        id={`pie-chart-container-${this.CHART_ID}`}
        data-test="react-autoql-pie-chart"
      >
        <svg
          className="pie-chart"
          ref={(el) => {
            this.chartElement = el
          }}
          width={this.props.width}
          height={this.props.height}
        />
        <g
          ref={(el) => {
            this.legendElement = el
          }}
          id={this.LEGEND_ID}
          className="legendOrdinal"
        />
      </g>
    )
  }
}
