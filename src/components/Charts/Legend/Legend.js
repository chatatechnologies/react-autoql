import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'

import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale'

import legendColor from '../D3Legend/D3Legend'

import { removeFromDOM } from '../../../js/Util.js'

export default class Legend extends Component {
  constructor(props) {
    super(props)

    this.LEGEND_WIDTH = 130
    this.LEGEND_ID = `axis-${uuid()}`
    this.BUTTON_PADDING = 5
    this.swatchElements = []
  }

  static propTypes = {
    legendTitle: PropTypes.string,
    legendLabels: PropTypes.arrayOf(PropTypes.shape({})),
    legendColumn: PropTypes.shape({}),
    placement: PropTypes.string,
    onLabelChange: PropTypes.func,
    onLegendClick: PropTypes.func,
    onLegendTitleClick: PropTypes.func,
    numberColumnIndices: PropTypes.arrayOf(PropTypes.number),
    topMargin: PropTypes.number,
    bottomMargin: PropTypes.number,
    rightLegendMargin: PropTypes.number,
    scale: PropTypes.func,
    col: PropTypes.shape({}),
    translate: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
  }

  static defaultProps = {
    legendTitle: undefined,
    onLabelChange: () => {},
    onLegendClick: () => {},
    onLegendTitleClick: () => {},
    translate: undefined,
    placement: 'right',
  }

  componentDidMount = () => {
    if (this.props.placement === 'right' || this.props.placement === 'bottom') {
      // https://d3-legend.susielu.com/
      this.renderLegend()
    }
  }

  componentDidUpdate = (prevProps) => {
    // only render legend once... unless labels changed
    if (
      (this.props.placement === 'right' || this.props.placement === 'bottom') &&
      !_isEqual(this.props.legendLabels, prevProps.legendLabels)
    ) {
      this.renderLegend()
    }
  }

  componentWillUnmount = () => {
    removeFromDOM(this.legendElement)
    removeFromDOM(this.legendSwatchElements)
    removeFromDOM(this.swatchElements)
  }

  // TODO: remove last visible legend label if it is cut off
  removeOverlappingLegendLabels = () => {
    // const legendContainer = select(
    //   `#legend-bounding-box-${this.LEGEND_ID}`
    // ).node()
    // select(this.rightLegendElement)
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

  styleLegendTitleNoBorder = (svg) => {
    svg
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .style('transform', 'translate(0, -5px)')
      .attr('data-test', 'legend-title')
      .attr('fill-opacity', 0.9)
  }

  styleLegendTitleWithBorder = (svg) => {
    svg
      .select('.legendTitle')
      .style('font-weight', 'bold')
      .style('transform', 'translate(0, -5px)')
      .attr('data-test', 'legend-title')
      .append('tspan')
      .text('  ▼')
      .style('font-size', '8px')
      .style('opacity', 0)
      .attr('class', 'react-autoql-axis-selector-arrow')

    // Add border that shows on hover
    this.titleBBox = {}
    try {
      this.titleBBox = svg.select('.legendTitle').node().getBBox()
    } catch (error) {
      console.error(error)
    }

    select(this.legendBorder)
      .attr('class', 'legend-title-border')
      .attr('width', _get(this.titleBBox, 'width', 0))
      .attr('height', _get(this.titleBBox, 'height', 0))
      .attr('x', _get(this.titleBBox, 'x', 0))
      .attr('y', _get(this.titleBBox, 'y', 0))
      .attr('stroke', 'transparent')
      .attr('stroke-width', '1px')
      .attr('fill', 'transparent')
      .attr('rx', 4)

    // Move to front
    this.legendElement = select(this.legendBorder).node()
    if (this.legendElement) {
      removeFromDOM(this.legendElement)
      this.legendElement.parentNode.appendChild(this.legendElement)
    }
  }

  renderLegend = () => {
    try {
      const self = this
      const { legendLabels } = this.props

      if (!legendLabels) {
        return
      }

      const legendScale = this.getLegendScale(legendLabels)

      if (this.props.placement === 'right') {
        this.legendSVG = select(this.rightLegendElement)

        this.legendSVG
          .attr('class', 'legendOrdinal')
          .style('fill', 'currentColor')
          .style('fill-opacity', '1')
          .style('font-family', 'inherit')
          .style('font-size', '10px')

        var legendOrdinal = legendColor()
          .orient('vertical')
          .shapePadding(6)
          .labelWrap(100)
          .scale(legendScale)
          .on('cellclick', function (d) {
            self.props.onLabelChange({ setLoading: false })
            self.props.onLegendClick(legendLabels.find((label) => label.label === d))
          })

        if (this.props.legendTitle) {
          legendOrdinal.title(this.props.legendTitle).titleWidth(100)
        }

        this.legendSVG.call(legendOrdinal).style('font-family', 'inherit')

        if (this.props.legendTitle) {
          if (this.props.onLegendTitleClick) {
            this.styleLegendTitleWithBorder(this.legendSVG)
          } else {
            this.styleLegendTitleNoBorder(this.legendSVG)
          }
        }

        // adjust container width to exact width of legend
        // this is so the updateMargins function works properly
        const legendWidth = select(this.rightLegendElement).node()?.getBBox()?.width || 0
        select(this.legendClippingContainer).attr('width', legendWidth)
        this.legendSVG.attr('clip-path', `url(#legend-clip-area-${this.LEGEND_ID})`)
      } else if (this.props.placement === 'bottom') {
        this.legendSVG = select(this.bottomLegendElement)
        this.legendSVG
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
            self.props.onLegendClick(d)
          })

        this.legendSVG.call(legendOrdinal).style('font-family', 'inherit')
      }

      this.applyStylesForHiddenSeries(legendLabels)
      // todo: get this working properly
      this.removeOverlappingLegendLabels()
    } catch (error) {
      console.error(error)
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
          el.querySelectorAll('tspan').forEach((tspan) => {
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
    const numSeries = this.props.numberColumnIndices?.length || 0
    const legendDx = (this.LEGEND_WIDTH * (numSeries - 1)) / 2
    const marginLeft = this.props.leftMargin || 0

    let legendClippingHeight =
      this.props.height -
      this.props.topMargin -
      // make legend smaller if labels are not rotated
      // because they might overlap the legend
      (!this.props.rotateLabels ? this.props.bottomMargin : 44) + // distance to bottom of axis labels
      20
    if (legendClippingHeight < 0) {
      legendClippingHeight = 0
    }

    let translateX = this.props.width
    // if (this.props.axesRef) {
    //   translateX = this.props.axesRef.getBBox().width
    // }

    return (
      <g data-test='legend'>
        {this.props.placement === 'right' && (
          <g
            ref={(el) => {
              this.rightLegendElement = el
            }}
            id={this.LEGEND_ID}
            data-test='right-legend'
            className='legendOrdinal right-legend'
            transform={`translate(${translateX}, ${this.props.legendTitle ? '30' : '25'})`}
          >
            <clipPath id={`legend-clip-area-${this.LEGEND_ID}`}>
              <rect
                ref={(el) => {
                  this.legendClippingContainer = el
                }}
                id={`legend-bounding-box-${this.LEGEND_ID}`}
                height={legendClippingHeight}
                width={this.props.rightLegendMargin}
                style={{ transform: `translate(0px, -30px)` }}
              />
            </clipPath>
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
        )}
        {this.props.placement === 'bottom' && (
          <g
            ref={(el) => {
              this.bottomLegendElement = el
            }}
            data-test='bottom-legend'
            id={this.LEGEND_ID}
            className='legendOrdinal'
            transform={`translate(${(this.props.width - marginLeft) / 2 + marginLeft - legendDx},${
              this.props.height - 30
            })`}
          />
        )}
      </g>
    )
  }
}
