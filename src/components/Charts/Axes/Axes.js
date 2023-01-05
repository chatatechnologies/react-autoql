import React from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'
import { Axis } from '../Axis'
import { Legend } from '../Legend'
import { getBBoxFromRef } from '../../../js/Util'
import { axesDefaultProps, axesPropTypes } from '../helpers'

export default class Axes extends React.Component {
  constructor(props) {
    super(props)
    this.LEGEND_PADDING = 20
    this.BOTTOM_AXIS_KEY = uuid()
    this.LEFT_AXIS_KEY = uuid()
    this.RIGHT_AXIS_KEY = uuid()
  }

  static propTypes = {
    ...axesPropTypes,
    onAxesRenderComplete: PropTypes.func,
  }

  static defaultProps = {
    ...axesDefaultProps,
    onAxesRenderComplete: () => {},
  }

  onAxisRenderComplete = (orient) => {
    switch (orient) {
      case 'Right': {
        this.rightAxisComplete = true
      }
      case 'Left': {
        this.leftAxisComplete = true
      }
      case 'Bottom': {
        this.bottomAxisComplete = true
      }
      case 'Top': {
        this.topAxisComplete = true
      }
    }

    if (!this.shouldRenderRightAxis(this.props)) {
      this.rightAxisComplete = true
    }

    if (!this.shouldRenderTopAxis(this.props)) {
      this.topAxisComplete = true
    }

    if (this.topAxisComplete && this.bottomAxisComplete && this.leftAxisComplete && this.rightAxisComplete) {
      this.forceUpdate(() => {
        this.props.onAxesRenderComplete()
      })
    }
  }

  renderBottomAxis = (innerHeight, innerWidth) => {
    const orient = 'Bottom'
    return (
      <Axis
        {...this.props}
        ref={(r) => (this.bottomAxis = r)}
        key={this.BOTTOM_AXIS_KEY}
        orient={orient}
        scale={this.props.xScale}
        translateY={innerHeight}
        ticks={this.props.xTicks}
        // rotateLabels={this.props.rotateLabels}
        rotateLabels={true}
        col={this.props.xCol}
        title={this.props.bottomAxisTitle}
        showGridLines={this.props.xGridLines}
        hasDropdown={this.props.hasXDropdown}
        innerWidth={innerWidth}
        onAxisRenderComplete={() => this.onAxisRenderComplete(orient)}
      />
    )
  }

  renderLeftAxis = (innerWidth) => {
    const orient = 'Left'
    return (
      <Axis
        {...this.props}
        key={this.LEFT_AXIS_KEY}
        orient={orient}
        scale={this.props.yScale}
        innerWidth={innerWidth}
        ticks={this.props.yTicks}
        translateY={0}
        col={this.props.yCol}
        title={this.props.leftAxisTitle}
        showGridLines={this.props.yGridLines}
        hasDropdown={this.props.hasYDropdown}
        onAxisRenderComplete={() => this.onAxisRenderComplete(orient)}
      />
    )
  }

  shouldRenderTopAxis = (props) => {
    return false
  }

  renderTopAxis = (title) => {
    if (!title) {
      return null
    }
  }

  shouldRenderRightAxis = (props) => {
    const shouldRenderAxis = !!props.yCol2 && !!props.yScale2
    return shouldRenderAxis
  }

  renderRightAxis = (innerWidth) => {
    const shouldRenderAxis = !!this.props.yCol2 && !!this.props.yScale2
    const shouldRenderLegend = !!this.props.legendLocation

    if (!shouldRenderAxis && !shouldRenderLegend) {
      return null
    }

    const orient = 'Right'

    return (
      <g ref={(r) => (this.rightAxis = r)} transform={`translate(${innerWidth}, 0)`}>
        {shouldRenderAxis && (
          <Axis
            {...this.props}
            ref={(r) => (this.rightAxisWithoutLegend = r)}
            key={this.RIGHT_AXIS_KEY}
            orient={orient}
            scale={this.props.yScale2}
            translateX={0}
            translateY={0}
            ticks={this.props.yTicks2}
            col={this.props.yCol2}
            title={this.props.rightAxisTitle}
            showGridLines={false}
            hasRightLegend={false}
            hasBottomLegend={false}
            hasDropdown={this.props.hasYDropdown}
            onAxisRenderComplete={() => this.onAxisRenderComplete(orient)}
          />
        )}
        {shouldRenderLegend && this.renderRightLegend()}
      </g>
    )
  }

  renderRightLegend = () => {
    let legendScale
    if (this.props.linearAxis === 'y') {
      legendScale = this.props.yScale
    } else if (this.props.linearAxis === 'x') {
      legendScale = this.props.xScale
    }

    let translateX = this.LEGEND_PADDING
    const rightAxisWidth = getBBoxFromRef(this.rightAxisWithoutLegend?.ref)?.width
    if (rightAxisWidth) {
      translateX += rightAxisWidth
    }

    return (
      <g transform={`translate(${translateX},0)`}>
        <Legend {...this.props} scale={legendScale} placement={this.props.legendLocation} />
      </g>
    )
  }

  render = () => {
    if (
      !this.props.yScale ||
      !this.props.xScale ||
      !this.props.height ||
      !this.props.width ||
      !this.props.xCol ||
      !this.props.yCol
    ) {
      return null
    }

    const xScaleRange = this.props.xScale?.range() || [0, 0]
    const yScaleRange = this.props.yScale?.range() || [0, 0]

    const innerWidth = xScaleRange[1] - xScaleRange[0]
    const innerHeight = yScaleRange[0] - yScaleRange[1]

    return (
      <g ref={(r) => (this.ref = r)}>
        <g className='react-autoql-axes' data-test='react-autoql-axes'>
          {this.renderBottomAxis(innerHeight, innerWidth)}
          {this.renderLeftAxis(innerWidth)}
          {this.renderRightAxis(innerWidth)}
        </g>
      </g>
    )
  }
}
