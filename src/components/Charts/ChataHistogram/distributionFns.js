import jstat from 'jstat'

export const normalPDF = ({ value, mean, stdDev }) => {
  return jstat.normal.pdf(value, mean, stdDev)
}

export const exponentialPDF = ({ value, mean }) => {
  const lambda = 1 / mean
  return jstat.exponential.pdf(value, lambda)
}

export const chiSquarePDF = ({ value, dataSize }) => {
  return jstat.chisquare.pdf(value, dataSize - 1)
}

export const lognormalPDF = ({ value, mean, stdDev }) => {
  // const sigma = Math.sqrt(Math.log(1 + (stdDev * stdDev) / (mean * mean)))
  // const mu = Math.log(mean) - (sigma * sigma) / 2
  return jstat.lognormal.pdf(value, mean, stdDev)
}

export const uniformPDF = ({ value, min, max }) => {
  const probability = jstat.uniform.pdf(value, min, max)

  return probability
}

export const gammaPDF = ({ value, mean, stdDev }) => {
  const shape = (mean / stdDev) ** 2
  const scale = stdDev ** 2 / mean

  const probability = jstat.gamma.pdf(value, shape, scale)

  return probability
}

export const cauchyPDF = ({ value, stdDev, median }) => {
  const scale = stdDev * Math.sqrt(2)
  const probability = (1 / Math.PI) * (scale / ((value - median) ** 2 + scale ** 2))

  return probability
}

export const weibullPDF = ({ value, mean, stdDev }) => {
  const shape = Math.pow(mean / stdDev, 1.086)
  const probability = (shape / stdDev) * (value / stdDev) ** (shape - 1) * Math.exp((-1 * (value / stdDev)) ** shape)

  return probability
}

export const normalPDFRange = ({ start, end, mean, stdDev }) => {
  // Area under the curve of the bucket range is the probability
  return numericalIntegration((value) => normalPDF({ value, mean, stdDev }), start, end)
}

export const numericalIntegration = (func, start, end, numSegments = 100) => {
  const segmentWidth = (end - start) / numSegments
  let integral = 0

  for (let i = 0; i < numSegments; i++) {
    const x1 = start + i * segmentWidth
    const x2 = x1 + segmentWidth
    const y1 = func(x1)
    const y2 = func(x2)
    const segmentArea = ((y1 + y2) * segmentWidth) / 2
    integral += segmentArea
  }

  return integral
}
