import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { pie, arc, symbol, symbolCircle } from 'd3-shape'
import { entries } from 'd3-collection'
import { legendColor } from 'd3-svg-legend'
import 'd3-transition'

import { formatElement, removeFromDOM } from '../../../js/Util'
import { getDataFormatting, getThemeConfig } from '../../../props/defaults'
import {
  chartDefaultProps,
  chartPropTypes,
  getTooltipContent,
} from '../helpers'

export default class Axis extends Component {
  constructor(props) {
    super(props)

    this.CHART_ID = uuid()
    this.LEGEND_ID = `react-autoql-pie-legend-${uuid()}`

    this.sortedData = props.data
      .concat() // this copies the array so the original isn't mutated
      .sort((aRow, bRow) => {
        const a = aRow[props.numberColumnIndex] || 0
        const b = bRow[props.numberColumnIndex] || 0
        return parseFloat(b) - parseFloat(a)
      })

    const { chartColors } = getThemeConfig(props.themeConfig)
    this.colorScale = scaleOrdinal()
      .domain(
        this.sortedData.map((d) => {
          return d[props.stringColumnIndex]
        })
      )
      .range(chartColors)

    const legendLabels = this.sortedData.map((d, i) => {
      const legendString = `${formatElement({
        element: d[props.stringColumnIndex] || 'Untitled Category',
        column: props.columns?.[props.stringColumnIndex],
      })}: ${formatElement({
        element: d[props.numberColumnIndex] || 0,
        column: _get(props, `columns[${props.numberColumnIndex}]`),
        config: props.columns?.[props.dataFormatting],
      })}`
      return {
        label: legendString.trim(),
        hidden: false,
        dataIndex: i,
      }
    })

    this.state = {
      activeKey: this.props.activeChartElementKey,
      legendLabels,
    }
  }

  static propTypes = {
    ...chartPropTypes,
    backgroundColor: PropTypes.string,
    margin: PropTypes.number,
  }

  static defaultProps = {
    ...chartDefaultProps,
    backgroundColor: 'transparent',
    margin: 40,
  }

  componentDidMount = () => {
    this.renderPie()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = () => {
    this.renderPie()
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legend)
    removeFromDOM(this.pieChartContainer)
  }

  renderPie = () => {
    removeFromDOM(this.pieChartContainer)

    const self = this

    this.setPieRadius()

    this.outerArc = arc()
      .innerRadius(self.outerRadius * 1.1)
      .outerRadius(self.outerRadius * 1.1)

    const pieChart = pie().value((d, i) => {
      return d.value[self.props.numberColumnIndex]
    })

    this.dataReady = pieChart(
      entries(
        self.sortedData.filter((d, i) => !this.state.legendLabels?.[i]?.hidden)
      )
    )

    this.renderPieContainer()
    this.renderPieSlices()
    this.renderLegend()

    // Finally, translate container of legend and pie chart to center of parent container
    this.centerVisualization()
  }

  renderPieContainer = () => {
    const { width, height } = this.props

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

  onSliceClick = (d) => {
    const newActiveKey = d.data.key
    if (newActiveKey === this.state.activeKey) {
      // Put it back if it is expanded
      this.setState({ activeKey: null })
    } else {
      this.props.onChartClick(
        d.data.value,
        this.props.numberColumnIndex,
        this.props.columns,
        this.props.stringColumnIndex,
        this.props.legendColumn,
        this.props.numberColumnIndex,
        newActiveKey
      )
      this.setState({ activeKey: newActiveKey })
    }
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
        return self.colorScale(d.data.value[self.props.stringColumnIndex])
      })
      .attr('data-for', 'chart-element-tooltip')
      .attr('data-tip', function(d) {
        return getTooltipContent({
          row: d.data.value,
          columns: self.props.columns,
          colIndex: self.props.numberColumnIndex,
          stringColumnIndex: self.props.stringColumnIndex,
          legendColumn: self.props.legendColumn,
          dataFormatting: self.props.dataFormatting,
        })
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
      .on('click', this.onSliceClick)

    // render active pie slice if there is one
    self.pieChartContainer.selectAll('path.slice').each(function(slice) {
      select(this)
        .transition()
        .duration(500)
        .attr('transform', function(d) {
          if (d.data.key === self.state.activeKey) {
            const a =
              d.startAngle + (d.endAngle - d.startAngle) / 2 - Math.PI / 2
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

  onLegendClick = (legendObjStr) => {
    const legendObj = JSON.parse(legendObjStr)
    const index = legendObj?.dataIndex
    if (!!this.state.legendLabels?.[index]) {
      const newLegendLabels = _cloneDeep(this.state.legendLabels)
      newLegendLabels[index].hidden = !this.state.legendLabels[index].hidden
      this.setState({ legendLabels: newLegendLabels })
    }
  }

  renderLegend = () => {
    const self = this
    const { height } = this.props
    const { chartColors } = getThemeConfig(this.props.themeConfig)

    let legendScale
    if (this.state.legendLabels) {
      legendScale = scaleOrdinal()
        .domain(this.state.legendLabels.map((obj) => JSON.stringify(obj)))
        .range(chartColors)
    } else {
      return
    }

    // The legend wrap length threshold should be half of the width
    // Because the pie will never be larger than half the width
    const legendWrapLength = this.props.width / 2 - 70 // 70 for the width of the circles and padding

    this.legend = select(this.legendElement)
    this.legend
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
      .labels(self.state.legendLabels.map((labelObj) => labelObj.label))
      .labelWrap(legendWrapLength)
      .scale(legendScale)
      .on('cellclick', this.onLegendClick)

    this.legend.select('.legendOrdinal').call(legendOrdinal)

    let legendBBox
    const legendElement = this.legend.select('.legendOrdinal').node()
    if (legendElement) {
      legendBBox = legendElement.getBBox()
    }

    const legendHeight = _get(legendBBox, 'height', 0)
    const legendWidth = _get(legendBBox, 'width', 0)
    const legendXPosition = this.props.width / 2 - legendWidth - 20
    const legendYPosition =
      legendHeight < height - 20 ? (height - legendHeight) / 2 : 15

    this.legend
      .select('.legendOrdinal')
      .attr('transform', `translate(${legendXPosition}, ${legendYPosition})`)

    this.applyStylesForHiddenSeries()
  }

  applyStylesForHiddenSeries = () => {
    const legendLabelTexts = this.state.legendLabels
      .filter((l) => l.hidden)
      .map((l) => l.label)

    this.legendSwatchElements = document.querySelectorAll(
      `#${this.LEGEND_ID} .label tspan`
    )

    if (this.legendSwatchElements) {
      this.legendSwatchElements.forEach((el) => {
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
