import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'
import { symbol, symbolSquare } from 'd3-shape'

import legendColor from '../D3Legend/D3Legend'

import { removeFromDOM } from '../../../js/Util.js'
import { getLegendLabelsForMultiSeries, mergeBboxes } from '../helpers'

export default class Legend extends Component {
  constructor(props) {
    super(props)

    this.MAX_LEGEND_WIDTH = 200
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.LEFT_PADDING = 20
    this.swatchElements = []
    this.justMounted = true
  }

  static propTypes = {
    title: PropTypes.string,
    legendLabels: PropTypes.arrayOf(PropTypes.shape({})),
    legendColumn: PropTypes.shape({}),
    placement: PropTypes.string,
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
    onLabelChange: () => {},
    onLegendClick: () => {},
    onRenderComplete: () => {},
    translate: undefined,
    placement: 'right',
  }

  componentDidMount = () => {
    // if (this.props.placement === 'right' || this.props.placement === 'bottom') {
    // https://d3-legend.susielu.com/
    this.renderAllLegends()
    this.forceUpdate()
    // }
  }

  componentDidUpdate = (prevProps) => {
    // only render legend once... unless labels changed
    if (
      (this.props.placement === 'right' || this.props.placement === 'bottom') &&
      !_isEqual(this.props.legendLabels, prevProps.legendLabels)
    ) {
      this.renderAllLegends()
    }

    // if (this.justMounted) {
    //   this.justMounted = false
    //   this.props.onRenderComplete()
    // }
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legendElement)
    removeFromDOM(this.legendSwatchElements)
    removeFromDOM(this.swatchElements)
  }

  renderAllLegends = () => {
    this.renderLegend(this.rightLegendElement, this.props.legendColumnIndices, this.props.title)
    if (this.props.hasSecondAxis) {
      const isSecondLegend = true
      this.renderLegend(this.rightLegendElement2, this.props.numberColumnIndices2, this.props.title2, isSecondLegend)
    }
  }

  // TODO: remove last visible legend label if it is cut off
  removeOverlappingLegendLabels = () => {
    // const legendContainer = select(
    //   `#legend-bounding-box-${this.LEGEND_ID}`
    // ).node()
    // select(legendElement)
    //   .selectAll('.cell')
    //   .attr('opacity', function(d) {
    //     // todo: fix this so the bboxes are absolute and intersection is possible
    //     const tspanElement = select(this)
    //       .select('tspan')
    //       .node()
    //     const isOverflowing = doesElementOverflowContainer(
    //       this,
    //       legendContainer
    //     )
    //     if (isOverflowing) {
    //       return 0
    //     }
    //     return 1
    //   })
  }

  styleLegendTitleNoBorder = (legendElement) => {
    select(legendElement)
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
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

    // select(this.legendBorder)
    //   .attr('class', 'legend-title-border')
    //   .attr('width', _get(this.titleBBox, 'width', 0))
    //   .attr('height', _get(this.titleBBox, 'height', 0))
    //   .attr('x', _get(this.titleBBox, 'x', 0))
    //   .attr('y', _get(this.titleBBox, 'y', 0))
    //   .attr('stroke', 'transparent')
    //   .attr('stroke-width', '1px')
    //   .attr('fill', 'transparent')
    //   .attr('rx', 4)

    // Move to front
    // this.legendElement = select(this.legendBorder).node()
    // if (this.legendElement) {
    //   removeFromDOM(this.legendElement)
    //   this.legendElement.parentNode.appendChild(this.legendElement)
    // }
  }

  onClick = (labelText, legendLabels) => {
    const label = legendLabels?.find((l) => l.label === labelText)
    const isHidingLabel = !label?.hidden
    const visibleLegendLabels = legendLabels?.filter((l) => !l.hidden)
    const allowClick = !isHidingLabel || visibleLegendLabels?.length > 1
    if (allowClick) {
      this.props.onLegendClick(label)
    }
  }

  renderLegend = (legendElement, columnIndices, title, isSecondLegend) => {
    try {
      const self = this
      // const { legendLabels } = this.props
      const legendLabels = getLegendLabelsForMultiSeries(this.props.columns, this.props.colorScale, columnIndices)

      if (!legendLabels) {
        return
      }

      const legendScale = this.getLegendScale(legendLabels)

      if (this.props.placement === 'right') {
        select(legendElement)
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal
        if (isSecondLegend) {
          //   // legendOrdinal.path(symbol().type(symbolSquare).size(75)())
          //   // legendOrdinal.path(
          //   //   'M-1.330127018922194,-1.330127018922194h1.660254037844387v1.660254037844387h-2.660254037844387Z',
          //   // )
          //   // M-4.330127018922194,-4.330127018922194h8.660254037844387v8.660254037844387h-8.660254037844387Z
          legendOrdinal = legendColor()
            .orient('vertical')
            .shape('line')
            .shapePadding(6)
            .labelWrap(100)
            .scale(legendScale)
            .on('cellclick', function (d) {
              self.onClick(d, legendLabels)
            })
        } else {
          legendOrdinal = legendColor()
            .orient('vertical')
            .path(symbol().type(symbolSquare).size(100)())
            .shapePadding(6)
            .labelWrap(100)
            .scale(legendScale)
            .on('cellclick', function (d) {
              self.onClick(d, legendLabels)
            })
        }

        if (title) {
          legendOrdinal.title(title).titleWidth(100)
        }

        select(legendElement).call(legendOrdinal).style('font-family', 'inherit')

        if (title) {
          if (this.props.onLegendTitleClick) {
            this.styleLegendTitleWithBorder(legendElement)
          } else {
            this.styleLegendTitleNoBorder(legendElement)
          }
        }

        // adjust container width to exact width of legend
        // this is so the updateMargins function works properly
        const legendWidth = select(legendElement).node()?.getBBox()?.width || 0
        select(this.legendClippingContainer).attr('width', legendWidth)
        select(legendElement).attr('clip-path', `url(#legend-clip-area-${this.LEGEND_ID})`)
      } else if (this.props.placement === 'bottom') {
        select(this.bottomLegendElement)
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal = legendColor()
          .orient('horizontal')
          .shapePadding(self.LEGEND_WIDTH)
          .labelWrap(120)
          .labelAlign('left')
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.onClick(d, legendLabels)
          })

        select(this.bottomLegendElement).call(legendOrdinal).style('font-family', 'inherit')
      }

      this.applyStylesForHiddenSeries(legendLabels)
      // todo: get this working properly
      this.removeOverlappingLegendLabels()
    } catch (error) {
      console.error(error)
    }

    if (this.justMounted) {
      this.justMounted = false
      this.props.onRenderComplete()
    }
  }

  applyStylesForHiddenSeries = (legendLabels) => {
    try {
      const legendLabelTexts = legendLabels
        .filter((l) => {
          return l.hidden
        })
        .map((l) => l.label)

      this.legendSwatchElements = document.querySelectorAll(`#${this.LEGEND_ID} .label`)

      if (this.legendSwatchElements) {
        this.legendSwatchElements.forEach((el, i) => {
          const textStrings = []
          el?.querySelectorAll('tspan').forEach((tspan) => {
            textStrings.push(tspan.textContent)
          })

          const legendLabelText = textStrings.join(' ')
          this.swatchElements[i] = el.parentElement.querySelector('.swatch')

          if (legendLabelTexts.includes(legendLabelText)) {
            this.swatchElements[i].style.opacity = 0.3
          } else {
            this.swatchElements[i].style.opacity = 1
          }
        })
      }
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

  render = () => {
    let legendClippingHeight = this.props.height // -
    if (legendClippingHeight < 0) {
      legendClippingHeight = 0
    }

    const legendBBox1 = this.rightLegendElement?.getBoundingClientRect()
    const legendBBox2 = this.rightLegendElement2?.getBoundingClientRect()
    const mergedBBox = mergeBboxes([legendBBox1, legendBBox2])
    const legendWidth = !isNaN(mergedBBox?.width) ? mergedBBox?.width : 0
    const topLegendBottomY = legendBBox1?.height ?? 0

    return (
      <g data-test='legend'>
        {this.props.placement === 'right' && (
          <>
            <g
              ref={(el) => {
                this.rightLegendElement = el
              }}
              id={this.LEGEND_ID}
              data-test='right-legend'
              className='legendOrdinal right-legend'
              transform={`translate(${this.LEFT_PADDING}, ${this.props.title ? 10 : 0})`}
            >
              {/* {this.props.legendColumn && (
              <LegendSelector
                {...this.props}
                column={this.props.legendColumn}
                positions={['bottom']}
                align='end'
                childProps={{
                  ref: (r) => (this.legendBorder = r),
                  x: _get(this.titleBBox, 'x', 0),
                  y: _get(this.titleBBox, 'y', 0),
                  width: _get(this.titleBBox, 'width', 0) + this.BUTTON_PADDING * 2,
                  height: _get(this.titleBBox, 'height', 0) + this.BUTTON_PADDING * 2,
                  //   transform: this.props.translate,
                }}
              />
            )} */}
            </g>
            <g
              ref={(el) => {
                this.rightLegendElement2 = el
              }}
              id={this.LEGEND_ID}
              data-test='right-legend-2'
              className='legendOrdinal right-legend-2'
              transform={`translate(${this.LEFT_PADDING}, ${topLegendBottomY + 30})`}
            />
          </>
        )}
        {/* <clipPath id={`legend-clip-area-${this.LEGEND_ID}`}> */}
        <rect
          ref={(el) => {
            this.legendClippingContainer = el
          }}
          id={`legend-bounding-box-${this.LEGEND_ID}`}
          height={this.props.height}
          width={legendWidth + this.LEFT_PADDING}
          style={{ stroke: 'transparent', fill: 'transparent', pointerEvents: 'none' }}
        />
        {/* </clipPath> */}
        {this.props.placement === 'bottom' && (
          <g
            ref={(el) => {
              this.bottomLegendElement = el
            }}
            data-test='bottom-legend'
            id={this.LEGEND_ID}
            className='legendOrdinal'
          />
        )}
      </g>
    )
  }
}
