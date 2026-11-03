import { getMeasureScale, getUnscaledClientRect, MEASURE_SCALE_ATTRIBUTE } from './measureScale'

const rect = { x: 40, y: 20, left: 40, top: 20, right: 140, bottom: 70, width: 100, height: 50 }

const nodeIn = (scale) => {
  const container = document.createElement('div')
  if (scale !== undefined) {
    container.setAttribute(MEASURE_SCALE_ATTRIBUTE, String(scale))
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  svg.appendChild(text)
  container.appendChild(svg)
  text.getBoundingClientRect = () => rect
  return text
}

describe('measuring inside a scaled element', () => {
  it('returns boxes as they are outside one', () => {
    const node = nodeIn()
    expect(getMeasureScale(node)).toBe(1)
    expect(getUnscaledClientRect(node)).toBe(rect)
  })

  it('divides boxes by the scale of the nearest scaled element, through an svg', () => {
    const node = nodeIn(0.5)
    expect(getMeasureScale(node)).toBe(0.5)
    expect(getUnscaledClientRect(node)).toEqual({
      x: 80,
      y: 40,
      left: 80,
      top: 40,
      right: 280,
      bottom: 140,
      width: 200,
      height: 100,
    })
  })

  it('ignores a scale it can’t use', () => {
    for (const bad of ['0', '-2', 'abc', '']) {
      expect(getMeasureScale(nodeIn(bad))).toBe(1)
    }
  })

  it('copes with nothing to measure', () => {
    expect(getUnscaledClientRect(null)).toBeUndefined()
    expect(getMeasureScale(null)).toBe(1)
  })
})
