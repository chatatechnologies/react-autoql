import React from 'react'
import { arc } from 'd3-shape'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import { select } from 'd3-selection'
import _cloneDeep from 'lodash.clonedeep'

import {
  legendColor,
  getPieChartData,
  deepEqual,
  removeFromDOM,
  getTooltipContent,
  getLegendLabels,
  DisplayTypes,
} from 'autoql-fe-utils'

import StringAxisSelector from '../Axes/StringAxisSelector'
import { chartDefaultProps, chartPropTypes } from '../chartPropHelpers'
import 'd3-transition'

// Simple legend state management using localStorage
const LegendStateManager = {
  sessionKey: null,

  setSession(columns, columnIndex) {
    const columnName = columns?.[columnIndex]?.name
    this.sessionKey = columnName ? `chata-pie-chart-legend-session-${columnName}` : null
  },

  resetSession() {
    this.sessionKey = null
  },

  save(legendLabels, columns, columnIndex) {
    this.setSession(columns, columnIndex)
    const key = this.sessionKey
    if (!key || !Array.isArray(legendLabels)) {return}

    try {
      const hiddenStates = {}
      legendLabels.forEach(({ label, hidden }) => {
        if (hidden) {hiddenStates[label] = true}
      })

      localStorage.setItem(key, JSON.stringify(hiddenStates))
    } catch (error) {
      console.error('Failed to save legend state:', error)
    }
  },

  load(legendLabels, columns, columnIndex) {
    this.setSession(columns, columnIndex)
    const key = this.sessionKey
    if (!key || !Array.isArray(legendLabels)) {return legendLabels}

    try {
      const stored = localStorage.getItem(key)
      if (!stored) {return legendLabels}

      const hiddenStates = JSON.parse(stored)
      return legendLabels.map((label) => ({
        ...label,
        hidden: !!hiddenStates[label.label],
      }))
    } catch (error) {
      console.error('Failed to load legend state:', error)
      return legendLabels
    }
  },
}

const isOtherCategory = (d) => {
  const isOtherCategory = d?.data?.value?.isOther
  return isOtherCategory
}

export default class ChataPieChart extends React.Component {
  constructor(props) {
    super(props)

    this.CHART_ID = uuid()
    this.LEGEND_ID = `react-autoql-pie-legend-${uuid()}`
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

    const legendLabels =
      getLegendLabels({
        columns,
        colorScales: { colorScale },
        columnIndexConfig: { stringColumnIndex, numberColumnIndex, numberColumnIndices, numberColumnIndices2 },
        dataFormatting,
        data,
        type: DisplayTypes.PIE,
      })?.labels ?? []

    this.state = {
      activeKey: this.props.activeChartElementKey,
      legendLabels: this.getControlledLegendLabels(legendLabels),
    }
  }

  static propTypes = {
    ...chartPropTypes,
    onAxesRenderComplete: PropTypes.func,
    backgroundColor: PropTypes.string,
    fontSize: PropTypes.number,
    margin: PropTypes.number,
    hiddenLegendLabels: PropTypes.arrayOf(PropTypes.string),
    onLegendVisibilityChange: PropTypes.func,
    isEditing: PropTypes.bool,
  }

  static defaultProps = {
    ...chartDefaultProps,
    onAxesRenderComplete: () => {},
    backgroundColor: 'transparent',
    fontSize: 12,
    margin: 40,
  }

  getControlledLegendLabels = (legendLabels) => {
    const { hiddenLegendLabels } = this.props
    const legendLabelsWithSavedState = LegendStateManager.load(
      legendLabels,
      this.props.columns,
      this.props.stringColumnIndex,
    )

    return legendLabelsWithSavedState.map((label) => ({
      ...label,
      hidden: Array.isArray(hiddenLegendLabels) ? hiddenLegendLabels.includes(label.label) : label.hidden,
    }))
  }

  filterHiddenSlices = (pieData) => (pieData ? pieData.filter((slice) => !slice?.data?.value?.legendLabel?.hidden) : [])

  storeHiddenLegendState = () => {
    LegendStateManager.save(this.state.legendLabels, this.props.columns, this.props.stringColumnIndex)
  }

  componentDidMount = () => {
    this.renderPie()
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const propsEqual = deepEqual(this.props, nextProps)
    const stateEqual = deepEqual(this.state, nextState)

    return !propsEqual || !stateEqual
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.stringColumnIndex !== this.props.stringColumnIndex) {
      LegendStateManager.resetSession()
    }

    if (
      !deepEqual(prevProps.data, this.props.data) ||
      !deepEqual(prevProps.columns, this.props.columns) ||
      !deepEqual(prevProps.hiddenLegendLabels, this.props.hiddenLegendLabels) ||
      prevProps.stringColumnIndex !== this.props.stringColumnIndex
    ) {
      const legendLabels =
        getLegendLabels({
          columns: this.props.columns,
          colorScales: { colorScale: this.props.colorScale },
          columnIndexConfig: {
            stringColumnIndex: this.props.stringColumnIndex,
            numberColumnIndex: this.props.numberColumnIndex,
            numberColumnIndices: this.props.numberColumnIndices,
            numberColumnIndices2: this.props.numberColumnIndices2,
          },
          dataFormatting: this.props.dataFormatting,
          data: this.props.data,
          type: DisplayTypes.PIE,
        })?.labels ?? []

      const controlledLabels = this.getControlledLegendLabels(legendLabels)
      const hasLegendChanges = !deepEqual(controlledLabels, this.state.legendLabels)

      if (hasLegendChanges) {
        this.setState({ legendLabels: controlledLabels }, () => {
          this.storeHiddenLegendState()
        })
      }
    } else if (!deepEqual(prevState.legendLabels, this.state.legendLabels)) {
      this.storeHiddenLegendState()
    }

    this.renderPie()
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legend)
    removeFromDOM(this.pieChartContainer)
    this.legendSwatchElements = null
  }

  renderPie = () => {
    requestAnimationFrame(() => {
      removeFromDOM(this.pieChartContainer)
      this.chartElement && select(this.chartElement).selectAll('*').remove()
      this.setPieRadius()

      const chartData = getPieChartData({
        data: this.props.data,
        numberColumnIndex: this.props.numberColumnIndex,
        legendLabels: this.state.legendLabels,
      })

      this.legendScale = chartData.legendScale
      this.pieChartFn = this.filterHiddenSlices(chartData.pieChartFn)
      this.renderPieContainer()
      this.renderPieSlices()
      this.renderLegend()

      // Finally, translate container of legend and pie chart to center of parent container
      this.centerVisualization()

      if (!this.renderComplete) {
        this.renderComplete = true
        this.props.onAxesRenderComplete()
      }
    })
  }

  renderPieContainer = () => {
    const { width, height } = this.props

    this.pieChartContainer = select(this.chartElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('class', 'slices')
      .attr('transform', `translate(${width / 2 + this.outerRadius},${height / 2})`)
  }

  onSliceClick = (d) => {
    try {
      if (isOtherCategory(d)) {
        return
      }

      const newActiveKey = d.data.key
      if (newActiveKey === this.state.activeKey) {
        // Put it back if it is expanded
        this.setState({ activeKey: null })
      } else {
        this.props.onChartClick({
          row: Object.values(d.data.value),
          columnIndex: this.props.numberColumnIndex,
          columns: this.props.columns,
          stringColumnIndex: this.props.stringColumnIndex,
          legendColumn: this.props.legendColumn,
          activeKey: newActiveKey,
        })
        this.setState({ activeKey: newActiveKey })
      }
    } catch (error) {
      console.error(error)
    }
  }

  renderPieSlices = () => {
    const self = this

    // build the pie chart
    this.pieChartContainer
      .selectAll('.slices')
      .data(self.pieChartFn)
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr('d', arc().innerRadius(self.innerRadius).outerRadius(self.outerRadius))
      .attr('fill', (d) => d?.data?.value?.legendLabel?.color)
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
      .style('fill-opacity', 1)
      .style('cursor', function (d) {
        if (isOtherCategory(d)) {
          return 'default'
        }
      })
      .attr('stroke-width', '0.5px')
      .attr('stroke', this.props.backgroundColor)
      .on('mouseover', function (d) {
        select(this).style('fill-opacity', 1)
      })
      .on('mouseout', function (d) {
        select(this).style('fill-opacity', 1)
      })
      .on('click', function (e, d) {
        self.onSliceClick(d, e)
      })

    // render active pie slice if there is one
    self.pieChartContainer.selectAll('path.slice').each(function (slice) {
      select(this)
        .transition()
        .duration(500)
        .attr('transform', function (d) {
          if (d.data.key === self.state.activeKey && self.sortedData?.length > 1) {
            const a = d.startAngle + (d.endAngle - d.startAngle) / 2 - Math.PI / 2
            const x = Math.cos(a) * 10
            const y = Math.sin(a) * 10
            // move it away from the circle center
            return `translate(${x},${y})`
          }
        })
    })
  }

  centerVisualization = () => {
    const containerElement = select(`#pie-chart-container-${this.CHART_ID}`).node()

    let containerBBox
    if (containerElement) {
      containerBBox = containerElement.getBBox()
    }

    const containerWidth = containerBBox?.width ?? 0
    const currentXPosition = containerBBox?.x ?? 0
    const finalXPosition = (this.props.width - containerWidth) / 2
    const xDelta = finalXPosition - currentXPosition

    select(`#pie-chart-container-${this.CHART_ID}`).attr('transform', `translate(${xDelta},0)`)
  }

  onLegendClick = (legendObjStr) => {
    let legendObj

    try {
      legendObj = JSON.parse(legendObjStr)
    } catch (error) {
      console.error(error)
      return
    }

    let index = -1
    let legendLabel = undefined
    let lookupLabel = legendObj?.label

    if (lookupLabel) {
      try {
        const parsed = JSON.parse(lookupLabel)
        if (parsed && parsed.label) {
          lookupLabel = parsed.label
        }
      } catch (e) {
        // Not a stringified object, use as is
      }
      index = this.state.legendLabels.findIndex((l) => l.label === lookupLabel)
      legendLabel = this.state.legendLabels[index]
    }
    if (!legendLabel && typeof legendObj?.dataIndex === 'number') {
      index = legendObj.dataIndex
      legendLabel = this.state.legendLabels[index]
    }
    if (!legendLabel || index === -1) {return}
    const onlyLabelVisible = this.state.legendLabels.every((label) => label.label === legendLabel.label || label.hidden)
    if (!onlyLabelVisible || legendLabel.hidden) {
      const newLegendLabels = this.state.legendLabels.map((label) => ({ ...label }))
      newLegendLabels[index].hidden = !this.state.legendLabels[index].hidden
      const newHiddenLabels = newLegendLabels.filter((l) => l.hidden).map((l) => l.label)
      if (this.props.onLegendVisibilityChange) {
        this.props.onLegendVisibilityChange(newHiddenLabels)
      }
      this.setState({ legendLabels: newLegendLabels }, () => {
        if (this.chartElement) {
          select(this.chartElement).selectAll('*').remove()
        }
        this.renderPie()
        this.storeHiddenLegendState()
      })
    }
  }

  renderLegendBorder = () => {
    return (
      <rect
        ref={(r) => (this.legendBorder = r)}
        width={0}
        height={0}
        rx={2}
        style={{
          stroke: 'var(--react-autoql-border-color)',
          fill: 'transparent',
          pointerEvents: 'none',
          strokeOpacity: 0.6,
        }}
      />
    )
  }

  renderLegend = () => {
    const self = this
    const { height } = this.props

    if (!this.legendScale) {
      return
    }

    // The legend wrap length threshold should be half of the width
    // Because the pie will never be larger than half the width
    const legendWrapLength = this.props.width / 2 - 70 // 70 for the width of the circles and padding
    const title = this.props?.columns?.[this.props.stringColumnIndex]?.display_name

    this.legend = select(this.legendElement)

    this.legend.select('*').remove()

    this.legend
      .append('g')
      .attr('class', 'legendOrdinal')
      .style('fill', 'currentColor')
      .style('fill-opacity', 1)
      .style('font-family', 'inherit')
      .style('font-family', 'inherit')
      .style('font-size', `${this.props.fontSize}px`)
      .style('stroke-width', '2px')

    var legendOrdinal = legendColor()
      .orient('vertical')
      .shapePadding(5)
      .labels(self.state.legendLabels.map((labelObj) => labelObj.label))
      .labelWrap(legendWrapLength)
      .labelOffset(10)
      .scale(self.legendScale)
      .title(title)
      .titleWidth(self.props.width / 2)
      .on('cellclick', function (event, d) {
        const data = d || select(this).data()[0]
        const dataIndex = self.state.legendLabels.findIndex((labelObj) => labelObj.label === data)
        const legendObjStr = JSON.stringify({
          dataIndex,
          label: data,
        })

        self.onLegendClick(legendObjStr)

        if (self.props.onLegendClick) {
          self.props.onLegendClick({ label: data, columnIndex: self.props.stringColumnIndex })
        }
      })

    this.legend.select('.legendOrdinal').call(legendOrdinal)

    let legendBBox
    const legendElement = this.legend.select('.legendOrdinal').node()

    if (legendElement) {
      select(legendElement)
        .selectAll('.cell')
        .style('font-size', `${this.props.fontSize - 2}px`)

      this.applyTitleStyles(title, legendElement)
      this.applyColumnSelectorStyles(legendElement)

      if (this.legendWrapper) {
        legendBBox = legendElement.getBBox()
      }
    }

    const legendHeight = legendBBox?.height ?? 0
    const legendWidth = legendBBox?.width ?? 0
    const legendXPosition = this.props.width / 2 - legendWidth - this.BORDER_PADDING - this.SECTION_PADDING
    const legendYPosition =
      legendHeight + this.BORDER_PADDING < height
        ? (height - legendHeight) / 2 + this.BORDER_PADDING
        : this.SECTION_PADDING

    select(this.legendWrapper).attr('transform', `translate(${legendXPosition}, ${legendYPosition})`)

    select(this.legendBorder)
      .attr('transform', `translate(${-this.BORDER_PADDING}, ${-this.BORDER_PADDING})`)
      .attr('x', legendBBox?.x)
      .attr('y', legendBBox?.y)
      .attr('height', legendHeight + 2 * this.BORDER_PADDING)
      .attr('width', legendWidth + 2 * this.BORDER_PADDING)

    this.applyStylesForHiddenSeries()
  }

  applyColumnSelectorStyles = (legendElement) => {
    if (!this.shouldRenderColumnSelector()) {
      return
    }

    // Add dropdown arrow
    select(legendElement)
      .select('.legendTitle')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '8px')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    // Add border that shows on hover
    this.titleBBox = {}
    try {
      const titleElement = this.legend.select('.legendTitle').node()
      const titleBBox = titleElement?.getBBox()
      const titleHeight = titleBBox?.height ?? 0
      const titleWidth = titleBBox?.width ?? 0

      this.titleBBox = titleBBox

      select(this.columnSelector)
        .attr('width', Math.round(titleWidth + 2 * this.AXIS_TITLE_BORDER_PADDING_LEFT))
        .attr('height', Math.round(titleHeight + 2 * this.AXIS_TITLE_BORDER_PADDING_TOP))
        .attr('x', Math.round(titleBBox?.x - this.AXIS_TITLE_BORDER_PADDING_LEFT))
        .attr('y', Math.round(titleBBox?.y - this.AXIS_TITLE_BORDER_PADDING_TOP))
        .style('transform', select(titleElement).style('transform'))
    } catch (error) {
      console.error(error)
    }
  }

  applyTitleStyles = (title, legendElement) => {
    if (title) {
      select(legendElement)
        .select('.legendTitle')
        .style('font-weight', 'bold')
        .attr('data-test', 'legend-title')
        .attr('fill-opacity', 0.9)
        .style('transform', 'translateY(-5px)')
    }
  }

  applyStylesForHiddenSeries = () => {
    const legendLabelTexts = this.state.legendLabels.filter((l) => l.hidden).map((l) => l.label)

    this.legendSwatchElements = document.querySelectorAll(`#${this.LEGEND_ID} .label tspan`)

    if (this.legendSwatchElements) {
      this.legendSwatchElements.forEach((el) => {
        const parentCell = el.parentElement.parentElement
        const swatchElement = parentCell.querySelector('.swatch')
        const textElement = parentCell.querySelector('.label')

        swatchElement.style.strokeWidth = '2px'

        if (legendLabelTexts.includes(el.textContent)) {
          swatchElement.style.opacity = 0.3
          swatchElement.style.stroke = '#999'
          textElement.style.opacity = 0.5
          textElement.style.textDecoration = 'line-through'
        } else {
          swatchElement.style.opacity = 1
          swatchElement.style.stroke = 'none'
          textElement.style.opacity = 1
          textElement.style.textDecoration = 'none'
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

  openSelector = () => {
    this.setState({ isColumnSelectorOpen: true })
  }

  closeSelector = () => {
    this.setState({ isColumnSelectorOpen: false })
  }

  shouldRenderColumnSelector = () => {
    return this.props.stringColumnIndices?.length > 1
  }

  renderTitleSelector = () => {
    if (this.shouldRenderColumnSelector())
    {return (
      <StringAxisSelector
        {...this.props}
        chartContainerRef={this.props.chartContainerRef}
        changeStringColumnIndex={this.props.changeStringColumnIndex}
        legendColumn={this.props.legendColumn}
        popoverParentElement={this.props.popoverParentElement}
        stringColumnIndices={this.props.stringColumnIndices}
        stringColumnIndex={this.props.stringColumnIndex}
        numberColumnIndex={this.props.numberColumnIndex}
        numberColumnIndices={this.props.numberColumnIndices}
        numberColumnIndices2={this.props.numberColumnIndices2}
        isAggregation={this.props.isAggregation}
        tooltipID={this.props.tooltipID}
        columns={this.props.columns}
        scale={this.legendScale}
        align='center'
        position='bottom'
        positions={['top', 'bottom', 'right', 'left']}
        axisSelectorRef={(r) => (this.columnSelector = r)}
        isOpen={this.state.isColumnSelectorOpen}
        closeSelector={this.closeSelector}
      >
        <rect
          ref={(r) => (this.columnSelector = r)}
          className='axis-label-border'
          data-test='axis-label-border'
          onClick={this.openSelector}
          fill='transparent'
          stroke='transparent'
          strokeWidth='1px'
          rx='4'
        />
      </StringAxisSelector>
    )}
  }

  render = () => {
    return (
      <g id={`pie-chart-container-${this.CHART_ID}`} data-test='react-autoql-pie-chart'>
        <svg
          className='pie-chart'
          ref={(el) => {
            this.chartElement = el
          }}
          width={this.props.width}
          height={this.props.height}
        />
        <g ref={(r) => (this.legendWrapper = r)}>
          <g
            ref={(el) => {
              this.legendElement = el
            }}
            id={this.LEGEND_ID}
            className='legendOrdinal'
          />
          {this.renderTitleSelector()}
          {this.renderLegendBorder()}
        </g>
      </g>
    )
  }
}
