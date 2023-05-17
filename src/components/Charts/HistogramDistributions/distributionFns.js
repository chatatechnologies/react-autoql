import jstat from 'jstat'
// import { integral } from 'mathjs'
const numericalIntegration = (func, start, end, numSegments) => {
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

export const exponentialPDF = ({ value, mean }) => {
  const lambda = 1 / mean
  const probability = jstat.exponential.pdf(value, lambda)
  return probability
}

// export const integrateRange = ({ value, fn, ...params }) => {
//   const start = value.x0
//   const end = value.x1

//   return integral(() => fn(...params), start, end)
// }

// export const normalPDF = ()
// const normalPDFFn = (x) => jstat.normal.pdf(x, mean, stdDev)

export const normalPDF = ({ value, mean, stdDev }) => {
  const start = value.x0
  const end = value.x1

  // Area under the curve of the bucket range is the probability
  const integral = numericalIntegration((x) => jstat.normal.pdf(x, mean, stdDev), start, end, 100)

  return integral

  // // Calculate the probability density at the range boundaries
  // const rangeStart = value.x0
  // const rangeEnd = value.x1

  // const pdfStart = jstat.normal.pdf(rangeStart, mean, stdDev)
  // const pdfEnd = jstat.normal.pdf(rangeEnd, mean, stdDev)

  // // Calculate the probability density as the difference in PDF values
  // const probabilityDensity = pdfEnd - pdfStart

  // return probabilityDensity

  // const probability = jstat.normal.pdf(value, mean, stdDev)
  // return probability
}

export const lognormalPDF = ({ value, mean, stdDev }) => {
  const sigma = Math.sqrt(Math.log(1 + (stdDev * stdDev) / (mean * mean)))
  const mu = Math.log(mean) - (sigma * sigma) / 2
  const probability = jstat.lognormal.pdf(value, mu, sigma)

  return probability
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
