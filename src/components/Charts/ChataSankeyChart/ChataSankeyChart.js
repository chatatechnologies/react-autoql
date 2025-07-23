import React from 'react'
import { arc } from 'd3-shape'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { drag } from 'd3-drag'

import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'
import { deepEqual, getTooltipContent, removeFromDOM } from 'autoql-fe-utils'

export default class ChataSankeyChart extends React.Component {
  constructor(props) {
    super(props)

    this.CHART_ID = uuid()
    this.LEGEND_ID = `react-autoql-sankey-legend-${uuid()}`
    this.BORDER_PADDING = 15
    this.BORDER_THICKNESS = 1
    this.TOP_ADJUSTMENT = 15
    this.AXIS_TITLE_BORDER_PADDING_LEFT = 5
    this.AXIS_TITLE_BORDER_PADDING_TOP = 3
    this.SECTION_PADDING = 30

    const {
      data,
      columns,
      colorScale,
      numberColumnIndex,
      numberColumnIndices,
      numberColumnIndices2,
      stringColumnIndex,
      dataFormatting,
    } = props

    this.state = {
      activeKey: this.props.activeChartElementKey,
    }
  }

  static propTypes = {
    ...chartPropTypes,
    onAxesRenderComplete: PropTypes.func,
    backgroundColor: PropTypes.string,
    fontSize: PropTypes.number,
    margin: PropTypes.number,
  }

  static defaultProps = {
    ...chartDefaultProps,
    onAxesRenderComplete: () => {},
    backgroundColor: 'transparent',
    fontSize: 12,
    margin: 40,
  }

  componentDidMount = () => {
    this.renderSankey()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate = () => {
    this.renderSankey()
  }

  componentWillUnmount = () => {
    removeFromDOM(this.sankeyChartContainer)
  }

  _wouldCreateCycle(graph, start) {
    const visited = new Set()
    const stack = new Set()

    const dfs = (node) => {
      if (stack.has(node)) return true
      if (visited.has(node)) return false

      visited.add(node)
      stack.add(node)

      const neighbors = graph[node] || []
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true
      }

      stack.delete(node)
      return false
    }

    return dfs(start)
  }

  aggregateSankeyData = () => {
    const data = this.props.data
    const stringColumnIndices = this.props.stringColumnIndices
    const numberColumnIndex = this.props.numberColumnIndex

    const linksMap = {}

    function addLink(source, target, value) {
      const key = `${source}___${target}`
      linksMap[key] = (linksMap[key] || 0) + value
    }

    // Step 1: Aggregate links
    data.forEach((row) => {
      const value = parseFloat(row[numberColumnIndex])
      if (isNaN(value) || value <= 0) return

      for (let i = 0; i < stringColumnIndices.length - 1; i++) {
        const source = row[stringColumnIndices[i]]
        const target = row[stringColumnIndices[i + 1]]
        if (source && target) {
          addLink(source, target, value)
        }
      }
    })

    // Step 2: Convert to array
    const allLinks = Object.entries(linksMap).map(([key, value]) => {
      const [source, target] = key.split('___')
      return { source, target, value }
    })

    // Step 3: Remove circular links
    const graph = {}
    const safeLinks = []

    for (const { source, target, value } of allLinks) {
      if (!graph[source]) graph[source] = []
      graph[source].push(target)

      if (this._wouldCreateCycle(graph, source)) {
        graph[source].pop() // Undo
        continue
      }

      safeLinks.push({ source, target, value })
    }

    return safeLinks
  }

  renderSankeyLinks = () => {
    const self = this
    console.log({ data: this.data, height: this.props.height, width: this.props.width })
    // 1. Extract unique nodes
    const nodeNames = Array.from(new Set(this.data.flatMap((d) => [d.source, d.target])))

    // 2. Create nodes array
    const nodes = nodeNames.map((name) => ({ name }))

    // 3. Map links source/target names to node indexes
    const links = this.data.map((d) => ({
      source: nodeNames.indexOf(d.source),
      target: nodeNames.indexOf(d.target),
      value: d.value,
    }))

    // Create sankey generator
    const sankeyGraph = sankey()
      .nodeWidth(20)
      .nodePadding(10)
      .extent([
        [1, 1],
        [this.props.width - 1, this.props.height - 6],
      ])

    // Construct sankey data structure
    const graph = { nodes, links }
    sankeyGraph(graph)

    // Draw links (flows)
    this.links = this.sankeyChartContainer
      .append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.5)
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', '#69b3a2')
      .attr('stroke-width', (d) => Math.max(1, d.width))
      .attr('stroke-linecap', 'round')

    // Draw nodes (rectangles)
    const node = this.sankeyChartContainer
      .append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .attr('data-tooltip-id', this.props.chartTooltipID)
      .attr('data-tooltip-html', function (d) {
        return getTooltipContent({
          row: d.data.value,
          columns: self.props.columns,
          colIndex: self.props.numberColumnIndex,
          colIndex2: self.props.stringColumnIndex,
          legendColumn: self.props.legendColumn,
          dataFormatting: self.props.dataFormatting,
          aggregated: self.props.isAggregated,
        })
      })

    node
      .append('rect')
      .attr('height', (d) => d.y1 - d.y0)
      .attr('width', sankeyGraph.nodeWidth())
      .attr('fill', '#4682b4')
      .attr('stroke', '#000')

    node
      .append('text')
      .attr('x', -6)
      .attr('y', (d) => (d.y1 - d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => d.name)
      .filter((d) => d.x0 < this.props.width / 2)
      .attr('x', 6 + sankeyGraph.nodeWidth())
      .attr('text-anchor', 'start')
  }

  renderSankeyContainer = () => {
    const { width, height } = this.props

    this.sankeyChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'links')
  }

  renderSankey = () => {
    removeFromDOM(this.sankeyChartContainer)

    this.data = this.aggregateSankeyData()

    this.renderSankeyContainer()
    this.renderSankeyLinks()

    if (!this.renderComplete) {
      this.renderComplete = true
      this.props.onAxesRenderComplete()
    }
  }

  render = () => {
    return (
      <g id={`sankey-chart-container-${this.CHART_ID}`} data-test='react-autoql-sankey-chart'>
        <svg
          className='sankey-chart'
          ref={(el) => {
            this.chartElement = el
          }}
          width={this.props.width}
          height={this.props.height}
        />
      </g>
    )
  }
}
