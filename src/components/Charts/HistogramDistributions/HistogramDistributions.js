import React, { Component } from 'react'
import _cloneDeep from 'lodash.clonedeep'
import { deviation, max, min, mean, median as median } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { v4 as uuid } from 'uuid'
import { rebuildTooltips } from '../../Tooltip'
import { chartElementDefaultProps, chartElementPropTypes } from '../helpers'
import { createSVGPath } from '../Line/lineFns'
import { normalPDF, exponentialPDF, lognormalPDF, gammaPDF, cauchyPDF, weibullPDF } from './distributionFns'

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

  getDistributionLine = (distribution, mean, stdDev, median, values, index) => {
    const pdfPoints = []
    values.forEach((value, i) => {
      if (!value) {
        return
      }

      if (i === 0) {
        const size = value.x1 - value.x0
        const firstPoint = {
          x0: value.x0 - size / 2,
          x1: value.x0 + size / 2,
        }
        pdfPoints.push({
          probability: distribution.fn({
            value: firstPoint,
            mean,
            stdDev,
            median,
          }),
          value: firstPoint,
        })
      }

      const probability = distribution.fn({ value, mean, stdDev, median })
      pdfPoints.push({ probability, value })

      if (i === values.length - 1) {
        const size = value.x1 - value.x0
        const lastPoint = {
          x0: value.x1 - size / 2,
          x1: value.x1 + size / 2,
        }
        pdfPoints.push({
          probability: distribution.fn({
            value: lastPoint,
            mean,
            stdDev,
            median,
          }),
          value: lastPoint,
        })
      }
    })

    const yScaleRange = this.props.yScale.range()
    const maxBucketSize = max(this.props.xScale.buckets.map((b) => b.length))
    const maxBucketY = this.props.yScale.getValue(maxBucketSize)

    const probabilityScale = scaleLinear()
      .domain([0, max(pdfPoints.map((p) => p.probability))])
      .range([max(yScaleRange), maxBucketY])

    console.log({ pdfPoints })

    const points = []
    pdfPoints.forEach((point) => {
      const x = this.props.xScale.getValue((point.value.x0 + point.value.x1) / 2)
      const y = probabilityScale(point.probability)
      points.push([x, y])
    })

    const d = createSVGPath(points, this.PATH_SMOOTHING)

    const path = (
      <path
        d={d}
        key={`distribution-line-${distribution.type}-${this.COMPONENT_KEY}`}
        className='distribution-line'
        stroke={this.props.colorScale2(index)}
        strokeWidth={1}
        fill='none'
      />
    )

    const hoverPath = (
      <path
        d={d}
        key={`distribution-hover-line-${distribution.type}-${this.COMPONENT_KEY}`}
        className='distribution-hover-line'
        data-tip={distribution.tooltip}
        data-for={this.props.chartTooltipID}
        data-effect='float'
        stroke='transparent'
        strokeWidth={5}
        fill='none'
      />
    )

    return [path, hoverPath]
  }

  render = () => {
    const { xScale, yScale, numberColumnIndex, data } = this.props

    if (!xScale || !yScale || !data?.length || !numberColumnIndex) {
      return null
    }

    const histogramData = data.map((d) => d[numberColumnIndex])
    const meanValue = mean(histogramData)
    const stdDev = deviation(histogramData)
    const medianValue = median(histogramData)

    // const domain = xScale.domain()
    // const values = this.createEquallySpacedPoints(domain, 30)
    // const buckets = xScale.buckets
    // const values = buckets.map((d) => d.x0)
    // values.push(buckets[buckets.length].x1)

    const paths = this.DISTRIBUTION_TYPES.map((distribution, i) => {
      return this.getDistributionLine(distribution, meanValue, stdDev, medianValue, xScale.buckets, i)
    })

    return <g data-test='distribution-lines'>{paths}</g>
  }
}
