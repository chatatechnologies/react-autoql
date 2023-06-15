import React, { Component } from 'react'
import { deviation, mean, median as median } from 'd3-array'
import { v4 as uuid } from 'uuid'
import { rebuildTooltips } from '../../../Tooltip'
import { chartElementDefaultProps, chartElementPropTypes } from '../../helpers'
import { createSVGPath } from '../../Line/lineFns'
import { normalPDF, exponentialPDF } from '../distributionFns'
import { formatElement } from '../../../../js/Util'

export default class HistogramDistributions extends Component {
  constructor(props) {
    super(props)

    this.PATH_SMOOTHING = 0.2
    this.COMPONENT_KEY = uuid()

    const lambdaFormat = new Intl.NumberFormat(props.dataFormatting?.languageCode ?? 'en-US', {
      maximumFractionDigits: 5,
    })

    this.DISTRIBUTION_TYPES = [
      {
        type: 'normal',
        fn: normalPDF,
        tooltip: ({ mean, stdDev }) =>
          `Normal Distribution<br/>Mean: ${this.formatValue(mean)}<br/>Standard Deviation: ±${this.formatValue(
            stdDev,
          )}`,
      },
      {
        type: 'exponential',
        fn: exponentialPDF,
        tooltip: ({ mean }) => `Exponential Distribution<br/>Lambda: ${lambdaFormat.format(1 / mean)}`,
      },
      // { type: 'lognormal', fn: lognormalPDF, tooltip: () => 'Lognormal Distribution' },
      // { type: 'gamma', fn: gammaPDF, tooltip: () => 'Gamma Distribution' },
      // { type: 'cauchy', fn: cauchyPDF, tooltip: () => 'Cauchy Distribution (Estimated)' },
      // { type: 'weibull', fn: weibullPDF, tooltip: () => 'Weibull Distribution (Estimated)' },
    ]

    this.TYPES_WITH_MEAN = ['normal']
    this.TYPES_WITH_STD_DEV = ['normal']

    this.state = {
      activeDistribution: undefined, // Set this default to 'normal' if we want a distribution fn dropdown
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
      column: this.props.xScale?.column,
      config: this.props.dataFormatting,
    })
  }

  createPathWithHoverStroke = ({ d, key, className, strokeWidth = 1, stroke, fill = 'none', tooltip, ...rest }) => {
    return (
      <g key={`${key}-group`}>
        <path
          d={d}
          key={key}
          className={className}
          stroke={stroke}
          strokeWidth={1}
          fill={fill}
          style={{ color: stroke }}
          {...rest}
        />
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
      </g>
    )
  }

  getScaledBucketProbability = (distribution, value) => {
    const probability = distribution.fn({
      value,
      mean: this.mean,
      stdDev: this.stdDev,
      median: this.median,
      dataSize: this.props.data.length,
    })

    return probability * this.scaleFactor
  }

  getDistributionLines = (distribution, i = 0) => {
    const { xScale, yScale, colorScale } = this.props
    const distributionLineColor = colorScale(i + 1)

    const svgElements = []

    const yRange = yScale.range()
    const xRange = xScale.range()

    const evenlySpacedDistributionValues = this.createEquallySpacedPoints(xScale.domain(), 1000)

    const probabilityDistributionPaths = []
    let probabilityDistributionPoints = []
    evenlySpacedDistributionValues.forEach((value, index) => {
      const probability = this.getScaledBucketProbability(distribution, value)

      const x = xScale.getValue(value)
      const y = yScale.getValue(probability)

      // Do not render point if it is outside chart bounds
      if (y < yRange[0] && y > yRange[1]) {
        probabilityDistributionPoints.push([x, y])
      } else if (probabilityDistributionPoints.length) {
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
          key: `distribution-line-${distribution.type}-${this.COMPONENT_KEY}-${i}`,
          tooltip: distribution.tooltip({ mean: this.mean, stdDev: this.stdDev }),
          className: 'distribution-line',
          stroke: this.props.colorScale(i + 1),
        }),
      )
    })

    if (this.TYPES_WITH_MEAN.includes(distribution.type)) {
      const meanProbability = this.getScaledBucketProbability(distribution, this.mean)
      let meanTopY = yScale.getValue(meanProbability)
      if (meanTopY > yRange[0]) {
        meanTopY = yRange[0]
      }
      const xMean = this.props.xScale(this.mean)
      const meanBottom = [xMean, yRange[1]]
      const meanTop = [xMean, yRange[0]]
      const meanPoints = [meanBottom, meanTop]
      const meanLine = this.createPathWithHoverStroke({
        d: createSVGPath(meanPoints, 0),
        key: `distribution-mean-line-${this.COMPONENT_KEY}-${i}`,
        className: 'distribution-mean-line',
        tooltip: `Mean: ${this.formatValue(this.mean)}`,
        stroke: distributionLineColor,
        strokeDasharray: 6,
      })

      svgElements.push(meanLine)
    }

    if (this.TYPES_WITH_STD_DEV.includes(distribution.type)) {
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
          key: `distribution-stddev-line-left-${this.COMPONENT_KEY}-${i}`,
          className: 'distribution-mean-line',
          tooltip: `Standard Deviation: ±${this.formatValue(this.stdDev)}`,
          stroke: distributionLineColor,
          strokeDasharray: 6,
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
          key: `distribution-stddev-line-right-${this.COMPONENT_KEY}-${i}`,
          className: 'distribution-mean-line',
          tooltip: `Standard Deviation: ±${this.formatValue(this.stdDev)}`,
          stroke: distributionLineColor,
          strokeDasharray: 6,
        })

        svgElements.push(stdDevRightLine)
      }
    }

    return svgElements
  }

  render = () => {
    if (!this.state.activeDistribution || this.props.isLoading) {
      return null
    }

    const distribution = this.DISTRIBUTION_TYPES.find((dist) => dist.type === this.state.activeDistribution)
    if (!distribution) {
      return null
    }

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

    const path = this.getDistributionLines(distribution)

    // Use this if we want to display them all at once
    // const paths = this.DISTRIBUTION_TYPES.map((distribution, i) => this.getDistributionLines(distribution, i))

    return <g data-test='distribution-lines'>{path}</g>
  }
}
