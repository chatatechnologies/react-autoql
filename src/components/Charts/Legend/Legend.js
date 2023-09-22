import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { v4 as uuid } from 'uuid'
import { isMobile } from 'react-device-detect'
import { legendColor, deepEqual, removeFromDOM, COLUMN_TYPES } from 'autoql-fe-utils'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { symbol, symbolSquare } from 'd3-shape'

import { mergeBboxes } from '../helpers'
import { AGG_TYPES, getLegendLabelsForMultiSeries } from 'autoql-fe-utils'

export default class Legend extends Component {
  constructor(props) {
    super(props)

    this.legendElements = []
    this.legendLabels1 = []
    this.legendLabels2 = []

    this.LEGEND_ID = `axis-${uuid()}`
    this.BORDER_PADDING = isMobile ? 10 : 15
    this.BORDER_THICKNESS = 1
    this.HORIZONTAL_LEGEND_SPACING = isMobile ? 15 : 20
    this.VERTICAL_LEGEND_SPACING = isMobile ? 15 : 25
    this.SHAPE_SIZE = isMobile ? 50 : 75
    this.TOP_ADJUSTMENT = isMobile ? 12 : 15
    this.DEFAULT_MAX_WIDTH = isMobile ? 100 : 140

    this.justMounted = true
  }

  static propTypes = {
    title: PropTypes.string,
    paddingLeft: PropTypes.number,
    paddingRight: PropTypes.number,
    paddingTop: PropTypes.number,
    paddingBottom: PropTypes.number,
    legendColumn: PropTypes.shape({}),
    orientation: PropTypes.string,
    onLabelChange: PropTypes.func,
    onLegendClick: PropTypes.func,
    onLegendTitleClick: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    scale: PropTypes.func,
    translate: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
    onRenderComplete: PropTypes.func,
  }

  static defaultProps = {
    title: undefined,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 11,
    onLabelChange: () => {},
    onLegendClick: () => {},
    onRenderComplete: () => {},
    translate: undefined,
    orientation: 'vertical',
  }

  componentDidMount = () => {
    // https://d3-legend.susielu.com/
    this.renderAllLegends()
  }

  shouldComponentUpdate = (nextProps) => {
    if (!deepEqual(this.props.columns, nextProps.columns)) {
      return true
    }

    if (this.props.height !== nextProps.height || this.props.outerHeight !== nextProps.outerHeight) {
      return true
    }

    return false
  }

  componentDidUpdate = () => {
    this.renderAllLegends()
  }

  componentWillUnmount = () => {
    this.legendElements?.forEach((el) => removeFromDOM(el))
  }

  getTotalLeftPadding = () => {
    return this.props.paddingLeft + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalRightPadding = () => {
    return this.props.paddingRight + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalHorizontalPadding = () => {
    return this.getTotalLeftPadding() + this.getTotalRightPadding()
  }

  getTotalBottomPadding = () => {
    return this.props.paddingBottom + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalTopPadding = () => {
    return this.props.paddingTop + this.BORDER_PADDING + this.BORDER_THICKNESS
  }

  getTotalVerticalPadding = () => {
    return this.getTotalBottomPadding() + this.getTotalTopPadding()
  }

  getMaxLegendHeight = () => {
    if (this.props.orientation === 'vertical') {
      return this.props.height - this.getTotalVerticalPadding()
    }

    return Math.floor(0.5 * this.props.outerHeight) - Math.ceil(2 * this.BORDER_PADDING)
  }

  getMaxSectionWidth = () => {
    let maxWidth = this.DEFAULT_MAX_WIDTH
    if (this.props.orientation === 'horizontal') {
      const minSections = 2
      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const spacingBetweenSections = (minSections - 1) * this.HORIZONTAL_LEGEND_SPACING
      const totalChartPadding = this.props.chartPadding * 2
      const totalAvailableWidth =
        this.props.outerWidth - totalHorizontalPadding - spacingBetweenSections - totalChartPadding
      const minWidth = Math.floor(totalAvailableWidth / minSections)

      if (minWidth < this.DEFAULT_MAX_WIDTH) {
        maxWidth = minWidth
      }
    }

    return maxWidth
  }

  renderAllLegends = () => {
    this.legendLabels1 = getLegendLabelsForMultiSeries(
      this.props.columns,
      this.props.colorScale,
      this.props.legendColumnIndices,
    )

    this.legendLabels2 = this.props.hasSecondAxis
      ? (this.legendLabels2 = getLegendLabelsForMultiSeries(
          this.props.columns,
          this.props.colorScale2,
          this.props.numberColumnIndices2,
        ))
      : []

    this.legendLabelSections = this.getlegendLabelSections(this.legendLabels1, this.legendLabels2)

    this.legendLabelSections?.forEach((legendLabels, i) => {
      this.renderLegend(legendLabels, i)
    })

    if (this.justMounted) {
      this.justMounted = false
      this.props.onRenderComplete()
    }
  }

  distributeListsEvenly = (list1Orig, list2Orig, numSections) => {
    const list1 = _cloneDeep(list1Orig)
    const list2 = _cloneDeep(list2Orig)

    const list1Size = list1?.length ?? 0
    const list2Size = list2?.length ?? 0
    const totalSize = list1Size + list2Size
    const list1Distribution = list1Size / totalSize

    let list1NumSections = Math.round(list1Distribution * numSections)
    if (list2Size) {
      if (list1NumSections === numSections && numSections > 1) list1NumSections = numSections - 1
      if (list1NumSections === 0 && numSections > 1) list1NumSections = 1
    }

    const sections = [...new Array(numSections)].map(() => [])

    for (let i = 0; i < totalSize; i++) {
      sections.forEach((sectionList, sectionIndex) => {
        const isSecondLegend = sectionIndex >= list1NumSections
        const currentList = isSecondLegend ? list2 : list1

        if (currentList.length > 0) {
          const labelObj = currentList.shift()
          labelObj.legendNumber = isSecondLegend ? 2 : 1
          labelObj.legendSectionIndex = i

          if (sectionIndex === 0) {
            labelObj.isFirst = true
          } else if (sectionIndex === list1NumSections) {
            labelObj.isFirst = true
          }

          sectionList.push(labelObj)
        }
      })
    }

    return sections
  }

  getlegendLabelSections = (legendLabels1, legendLabels2) => {
    let totalSections = this.totalPossibleSections
    const legendLabels1Size = legendLabels1?.length ?? 0
    const legendLabels2Size = legendLabels2?.length ?? 0
    const totalLabels = legendLabels1Size + legendLabels2Size

    if (totalLabels < this.totalPossibleSections) {
      totalSections = totalLabels
    }

    return this.distributeListsEvenly(legendLabels1, legendLabels2, totalSections)
  }

  removeHiddenLegendLabels = (legendElement) => {
    const legendContainerBBox = this.legendBorder?.getBoundingClientRect()
    const legendBottom = (legendContainerBBox?.y ?? 0) + (legendContainerBBox?.height ?? 0) - this.BORDER_PADDING

    let hasRemovedElement = false
    let removedElementYBottom = undefined
    let removedElementTransform = undefined

    select(legendElement)
      .selectAll('.cell')
      .each(function () {
        if (hasRemovedElement) {
          select(this).remove()
        } else {
          const cellBBox = this.getBoundingClientRect()
          const cellBottom = (cellBBox?.y ?? 0) + (cellBBox?.height ?? 0)
          if (cellBottom > legendBottom) {
            const bbox = this.getBBox()
            removedElementYBottom = (bbox?.y ?? 0) + (bbox?.height ?? 0)
            removedElementTransform = select(this).attr('transform')
            select(this).remove()

            // Setting this to true lets loop skip bounding rect calculation
            // since every cell after this one should be removed
            hasRemovedElement = true
          }
        }
      })

    if (hasRemovedElement && removedElementTransform) {
      // Add red arrow to bottom of legend to show not all labels are visible
      const tooltipID = this.props.chartTooltipID
      select(legendElement).select('.legend-hidden-field-arrow').remove()
      select(legendElement)
        .append('text')
        .html('&#9660 ...')
        .attr('class', 'legend-hidden-field-arrow')
        .attr('y', removedElementYBottom)
        .attr('transform', removedElementTransform)
        .attr('data-tip', 'Some legend fields are hidden. Please expand the chart size to view them.')
        .attr('data-for', tooltipID)
        .style('font-size', `${this.props.fontSize - 3}px`)
        .style('color', 'red')
        .style('font-weight', 'bold')
        .style('cursor', 'default')
    }
  }

  styleLegendTitleNoBorder = (legendElement, isFirstSection) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
      .style('transform', 'translateY(-5px)')
  }

  styleLegendTitleWithBorder = (legendElement) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '8px')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    // Add border that shows on hover
    this.titleBBox = {}
    try {
      this.titleBBox = select(legendElement).select('.legendTitle').node().getBBox()
    } catch (error) {
      console.error(error)
    }
  }

  onClick = (labelText, labels) => {
    const label = labels?.find((l) => l.label === labelText)

    if (!label) {
      return
    }

    const isHidingLabel = !label.hidden
    const visibleLegendLabels = labels?.filter((l) => !l.hidden)
    const allowClick = !isHidingLabel || visibleLegendLabels?.length > 1

    if (allowClick) {
      this.props.onLegendClick(label)
    }
  }

  getLegendTitleCase = (title) => {
    if (title?.length < 2) {
      return title
    }

    return title[0].toUpperCase() + title.substring(1)
  }

  getLegendTitleFromColumns = (columnIndices) => {
    if (this.props.isAggregated) {
      return this.props.legendColumn?.display_name ?? 'Legend'
    }

    let title = 'Fields'

    const legendColumns = columnIndices.map((index) => this.props.columns[index])

    const columnTypeArray = columnIndices.map((index) => this.props.columns[index].type)
    const allTypesEqual = !columnTypeArray.find((type) => type !== columnTypeArray[0])
    if (this.props.hasSecondAxis && allTypesEqual) {
      const columnTypeName = COLUMN_TYPES[columnTypeArray[0]]?.description
      if (columnTypeName) {
        title = `${columnTypeName} ${title}`
      }
    }

    const aggTypeArray = legendColumns.map((col) => col.aggType)
    const allAggTypesEqual = !aggTypeArray.find((agg) => agg !== aggTypeArray[0])
    if (allAggTypesEqual) {
      const aggName = AGG_TYPES[aggTypeArray[0]]?.displayName
      if (aggName) {
        title = `${title} (${aggName})`
      }
    }

    return title
  }

  renderLegend = (legendLabels, sectionIndex) => {
    try {
      const self = this

      if (!legendLabels?.length) {
        return
      }

      const legendNumber = legendLabels[0]?.legendNumber
      const columnIndices = legendNumber === 2 ? this.props.numberColumnIndices2 : this.props.legendColumnIndices
      const isFirstSection = !!legendLabels[0]?.isFirst
      const legendElement = this.legendElements[sectionIndex]
      const isSecondLegend = legendNumber === 2
      const allLabels = legendNumber === 2 ? this.legendLabels2 : this.legendLabels1
      const title = this.getLegendTitleCase(this.getLegendTitleFromColumns(columnIndices))
      const legendScale = this.getLegendScale(legendLabels)
      const maxSectionWidth = this.getMaxSectionWidth()

      var legendOrdinal = legendColor()
        .orient('vertical')
        .path(symbol().type(symbolSquare).size(this.SHAPE_SIZE)())
        .shapePadding(8)
        .labelWrap(maxSectionWidth - 20)
        .labelOffset(10)
        .scale(legendScale)
        .title(title)
        .titleWidth(maxSectionWidth)
        .on('cellclick', function (d) {
          self.onClick(select(this)?.data()?.[0], allLabels)
        })

      if (isSecondLegend) {
        legendOrdinal.shape('line')
      } else if (this.props.shape) {
        legendOrdinal.shape(this.props.shape)
      }

      select(legendElement)
        .call(legendOrdinal)
        .attr('class', 'legendOrdinal')
        .style('fill', 'currentColor')
        .style('fill-opacity', '1')
        .style('font-family', 'inherit')
        .style('font-size', `${this.props.fontSize}px`)

      select(legendElement)
        .selectAll('.cell')
        .style('font-size', `${this.props.fontSize - 2}px`)

      if (sectionIndex > 0) {
        const previousLegendSectionsBBox = mergeBboxes(
          this.legendElements.filter((el, i) => el && i < sectionIndex).map((el) => el.getBoundingClientRect()),
        )

        if (this.props.orientation === 'vertical') {
          const sectionShift = (previousLegendSectionsBBox?.height ?? 0) + this.VERTICAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(0,${sectionShift})`)
        } else if (this.props.orientation === 'horizontal') {
          const sectionShift = (previousLegendSectionsBBox?.width ?? 0) + this.HORIZONTAL_LEGEND_SPACING
          select(legendElement).attr('transform', `translate(${sectionShift},0)`)
        }
      }

      this.applyTitleStyles(title, isFirstSection, legendElement)

      const mergedBBox = mergeBboxes(this.legendElements.map((el) => el?.getBoundingClientRect()))

      this.combinedLegendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
      this.combinedLegendHeight = !isNaN(mergedBBox?.height) ? mergedBBox?.height : 0

      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const totalVerticalPadding = this.getTotalVerticalPadding()

      const maxLegendWidth = this.props.outerWidth - totalHorizontalPadding
      const maxLegendHeight = this.getMaxLegendHeight()

      const height = this.combinedLegendHeight <= maxLegendHeight ? this.combinedLegendHeight : maxLegendHeight
      const width = this.combinedLegendWidth <= maxLegendWidth ? this.combinedLegendWidth : maxLegendWidth

      select(this.legendClippingContainer)
        .attr('height', height + totalVerticalPadding)
        .attr('width', width + totalHorizontalPadding)

      select(this.legendBorder)
        .attr('height', height + 2 * this.BORDER_PADDING)
        .attr('width', width + 2 * this.BORDER_PADDING)

      this.removeHiddenLegendLabels(legendElement)
      this.applyStylesForHiddenSeries(legendElement, legendLabels)
    } catch (error) {
      console.error(error)
    }
  }

  applyTitleStyles = (title, isFirstSection, legendElement) => {
    if (title) {
      if (this.props.onLegendTitleClick) {
        this.styleLegendTitleWithBorder(legendElement, isFirstSection)
      } else {
        this.styleLegendTitleNoBorder(legendElement)
      }

      if (!isFirstSection) {
        select(legendElement).select('.legendTitle').style('fill-opacity', 0)
      }
    }
  }

  applyStylesForHiddenSeries = (legendElement, legendLabels) => {
    try {
      select(legendElement)
        .selectAll('.cell')
        .each(function (label) {
          const legendLabel = legendLabels.find((l) => l.label === label)
          if (legendLabel) {
            select(this).select('.swatch').attr('stroke', legendLabel.color).attr('stroke-location', 'outside')
            if (legendLabel.hidden) {
              select(this).attr('class', 'cell hidden')
            } else {
              select(this).attr('class', 'cell visible')
            }
          }
        })
    } catch (error) {
      console.error(error)
    }
  }

  getLegendScale = (legendLabels) => {
    const colorRange = legendLabels.map((obj) => {
      return obj.color
    })

    return scaleOrdinal()
      .domain(
        legendLabels.map((obj) => {
          return obj.label
        }),
      )
      .range(colorRange)
  }

  renderLegendSections = () => {
    if (this.props.orientation === 'horizontal') {
      const maxSectionWidth = this.getMaxSectionWidth()
      const totalHorizontalPadding = this.getTotalHorizontalPadding()
      const totalPossibleWidth = this.props.outerWidth - totalHorizontalPadding

      const availableWidth =
        totalPossibleWidth - this.HORIZONTAL_LEGEND_SPACING * (Math.ceil(totalPossibleWidth / maxSectionWidth) - 1)

      const totalPossibleSections = Math.floor(availableWidth / maxSectionWidth)

      this.totalPossibleSections = totalPossibleSections >= 2 ? totalPossibleSections : 2
    } else if (this.props.hasSecondAxis) {
      this.totalPossibleSections = 2
    }

    if (!this.totalPossibleSections) {
      this.totalPossibleSections = 1
    }

    const sections = [...new Array(this.totalPossibleSections)].map((row, i) => {
      return (
        <g
          ref={(el) => (this.legendElements[i] = el)}
          key={`${this.LEGEND_ID}-${i}`}
          data-test='react-autoql-legend'
          className='legendOrdinal react-autoql-legend'
        />
      )
    })

    return sections
  }

  renderLegendBorder = () => {
    return (
      <rect
        ref={(r) => (this.legendBorder = r)}
        width={0}
        height={0}
        rx={2}
        transform={`translate(${-this.BORDER_PADDING - this.BORDER_THICKNESS},${
          -this.BORDER_PADDING - this.TOP_ADJUSTMENT - this.BORDER_THICKNESS
        })`}
        style={{
          stroke: 'var(--react-autoql-border-color)',
          fill: 'transparent',
          pointerEvents: 'none',
          strokeOpacity: 0.6,
        }}
      />
    )
  }

  renderLegendClippingContainer = (translateX, translateY) => {
    return (
      <rect
        ref={(el) => (this.legendClippingContainer = el)}
        width={0}
        height={0}
        rx={4}
        transform={`translate(${-translateX},${-translateY})`}
        style={{
          stroke: 'transparent',
          fill: 'transparent',
          pointerEvents: 'none',
        }}
      />
    )
  }

  render = () => {
    const translateX = this.getTotalLeftPadding()
    const translateY = this.getTotalTopPadding() + this.TOP_ADJUSTMENT

    return (
      <g data-test='legend' transform={`translate(${translateX}, ${translateY})`}>
        {this.renderLegendSections()}
        {this.renderLegendClippingContainer(translateX, translateY)}
        {this.renderLegendBorder()}
      </g>
    )
  }
}
