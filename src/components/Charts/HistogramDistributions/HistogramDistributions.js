import React, { Component } from 'react'
import _cloneDeep from 'lodash.clonedeep'
import { deviation, max, min, mean, median as median } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { v4 as uuid } from 'uuid'
import { rebuildTooltips } from '../../Tooltip'
import { chartElementDefaultProps, chartElementPropTypes } from '../helpers'
import { createSVGPath } from '../Line/lineFns'
import {
  normalPDF,
  exponentialPDF,
  lognormalPDF,
  gammaPDF,
  cauchyPDF,
  weibullPDF,
  numericalIntegration,
  normalPDFRange,
} from './distributionFns'
import { formatElement } from '../../../js/Util'

export default class HistogramDistributions extends Component {
  constructor(props) {
    super(props)

    this.PATH_SMOOTHING = 0.2
    this.COMPONENT_KEY = uuid()

    this.DISTRIBUTION_TYPES = [
      { type: 'normal', fn: normalPDF, tooltip: 'Normal Distribution' },
      // { type: 'exponential', fn: exponentialPDF, tooltip: 'Exponential Distribution' },
      // { type: 'lognormal', fn: lognormalPDF, tooltip: 'Lognormal Distribution' },
      // { type: 'gamma', fn: gammaPDF, tooltip: 'Gamma Distribution' },
      // { type: 'cauchy', fn: cauchyPDF, tooltip: 'Cauchy Distribution (Estimated)' },
      // { type: 'weibull', fn: weibullPDF, tooltip: 'Weibull Distribution (Estimated)' },
    ]

    this.state = {
      activeDistribution: 'normal',
    }
  }

  static propTypes = chartElementPropTypes
  static defaultProps = chartElementDefaultProps

  componentDidMount = () => {
    rebuildTooltips()
  }

  createEquallySpacedPoints = (domain, length) => {
    const start = domain[0]
    const end = domain[1]
    const stepSize = (end - start) / (length - 1)

    return [...Array(length).keys()].map((i) => start + i * stepSize)
  }

  formatValue = (value) => {
    return formatElement({
      element: value,
      column: this.props.columns[this.props.numberColumnIndex],
      config: this.props.dataFormatting,
    })
  }

  createPathWithHoverStroke = ({ d, key, className, strokeWidth = 1, stroke, fill = 'none', tooltip }) => {
    return (
      <>
        <path d={d} key={key} className={className} stroke='red' strokeWidth={1} fill={fill} />
        <path
          d={d}
          key={`${key}-hover`}
          className='path-hover-line'
          data-tip={tooltip}
          data-for={this.props.chartTooltipID}
          data-effect='float'
          stroke='transparent'
          strokeWidth={strokeWidth + 5}
          fill='none'
        />
      </>
    )
  }

  getScaledBucketProbability = (distribution, value) => {
    const probability = distribution.fn({
      value,
      mean: this.mean,
      stdDev: this.stdDev,
      median: this.median,
    })

    return probability * this.scaleFactor
  }

  getDistributionLines = (distribution, i) => {
    const { xScale, yScale } = this.props

    const svgElements = []

    const yRange = yScale.range()
    const xRange = xScale.range()

    const evenlySpacedDistributionValues = this.createEquallySpacedPoints(xScale.domain(), 100)

    const probabilityDistributionPaths = []
    let probabilityDistributionPoints = []
    evenlySpacedDistributionValues.forEach((value, index) => {
      const probability = this.getScaledBucketProbability(distribution, value)

      const x = xScale.getValue(value)
      const y = yScale.getValue(probability)

      // Do not render point if it is outside chart bounds
      if (y <= yRange[0] && y >= yRange[1]) {
        probabilityDistributionPoints.push([x, y])
      } else {
        probabilityDistributionPaths.push(probabilityDistributionPoints)
        probabilityDistributionPoints = []
      }

      if (index === evenlySpacedDistributionValues?.length - 1 && !!probabilityDistributionPoints.length) {
        probabilityDistributionPaths.push(probabilityDistributionPoints)
      }
    })

    probabilityDistributionPaths.forEach((points) => {
      svgElements.push(
        this.createPathWithHoverStroke({
          d: createSVGPath(points, this.PATH_SMOOTHING),
          key: `distribution-line-${distribution.type}-${this.COMPONENT_KEY}`,
          tooltip: distribution.tooltip,
          className: 'distribution-line',
          stroke: this.props.colorScale(i + 1),
        }),
      )
    })

    const meanProbability = this.getScaledBucketProbability(distribution, this.mean)
    let meanTopY = yScale.getValue(meanProbability)
    if (meanTopY > yRange[0]) {
      meanTopY = yRange[0]
    }
    const xMean = this.props.xScale(this.mean)
    const meanBottom = [xMean, yScale.getValue(0)]
    const meanTop = [xMean, meanTopY]
    const meanPoints = [meanBottom, meanTop]
    const meanLine = this.createPathWithHoverStroke({
      d: createSVGPath(meanPoints, 0),
      key: `distribution-mean-line-${this.COMPONENT_KEY}`,
      className: 'distribution-mean-line',
      tooltip: `Mean: ${this.formatValue(this.mean)}`,
      stroke: 'red',
    })

    svgElements.push(meanLine)

    const stdDevLeftValue = this.mean - this.stdDev
    const stdDevLineLeftX = xScale.getValue(stdDevLeftValue)
    if (stdDevLineLeftX >= xRange[0]) {
      const stdDevLeftProbability = this.getScaledBucketProbability(distribution, stdDevLeftValue)

      let stdDevLeftTopY = yScale.getValue(stdDevLeftProbability)
      if (stdDevLeftTopY < yRange[1]) {
        stdDevLeftTopY = yRange[1]
      }

      const stdDevLeftTop = [stdDevLineLeftX, yScale.getValue(stdDevLeftProbability)]
      const stdDevLeftBottom = [stdDevLineLeftX, yScale.getValue(0)]
      const stdDevLeftPoints = [stdDevLeftBottom, stdDevLeftTop]
      const stdDevLeftLine = this.createPathWithHoverStroke({
        d: createSVGPath(stdDevLeftPoints, 0),
        key: `distribution-stddev-line-left-${this.COMPONENT_KEY}`,
        className: 'distribution-mean-line',
        tooltip: `Standard Deviation: ±${this.formatValue(this.stdDev)}`,
        stroke: 'red',
      })

      svgElements.push(stdDevLeftLine)
    }

    const stdDevRightValue = this.mean + this.stdDev
    const stdDevLineRightX = xScale.getValue(stdDevRightValue)
    if (stdDevLineRightX <= xRange[1]) {
      const stdDevRightProbability = this.getScaledBucketProbability(distribution, stdDevRightValue)

      let stdDevRightTopY = yScale.getValue(stdDevRightProbability)
      if (stdDevRightTopY < yRange[1]) {
        stdDevRightTopY = yRange[1]
      }

      const stdDevRightTop = [stdDevLineRightX, stdDevRightTopY]
      const stdDevRightBottom = [stdDevLineRightX, this.props.yScale(0)]
      const stdDevRightPoints = [stdDevRightBottom, stdDevRightTop]

      const stdDevRightLine = this.createPathWithHoverStroke({
        d: createSVGPath(stdDevRightPoints, 0),
        key: `distribution-stddev-line-right-${this.COMPONENT_KEY}`,
        className: 'distribution-mean-line',
        tooltip: `Standard Deviation: ±${this.formatValue(this.stdDev)}`,
        stroke: 'red',
      })

      svgElements.push(stdDevRightLine)
    }

    return svgElements
  }

  render = () => {
    const { xScale, yScale, numberColumnIndex, data, buckets } = this.props
    if (!xScale || !yScale || !data?.length || !numberColumnIndex || !buckets?.length) {
      return null
    }

    const histogramData = data.map((d) => d[numberColumnIndex])
    const bucketSample = buckets[1] ?? buckets[0]

    this.mean = mean(histogramData)
    this.stdDev = deviation(histogramData)
    this.median = median(histogramData)
    this.bucketSize = bucketSample.x1 - bucketSample.x0
    this.scaleFactor = this.bucketSize * this.props.data?.length

    const paths = this.DISTRIBUTION_TYPES.map((distribution, i) => this.getDistributionLines(distribution, i))

    return <g data-test='distribution-lines'>{paths}</g>
  }
}
