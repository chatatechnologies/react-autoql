// Charts lay themselves out from getBoundingClientRect, and a CSS transform on an ancestor scales what that
// returns, so a chart inside a scaled element would draw itself at the scaled size and then be scaled
// again. An element that scales its content with a transform says so with data-react-autoql-scale (the
// report builder's zoomed page does): inside it, boxes are divided by that scale, so the chart lays out at
// its true size and the transform alone shrinks or enlarges it. Anywhere else the scale is 1 and boxes are
// returned as they are.

export const MEASURE_SCALE_ATTRIBUTE = 'data-react-autoql-scale'

export const getMeasureScale = (node) => {
  const scaled = node?.closest?.(`[${MEASURE_SCALE_ATTRIBUTE}]`)
  const scale = Number(scaled?.getAttribute(MEASURE_SCALE_ATTRIBUTE))
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

// getBoundingClientRect, in the coordinates the chart lays out in.
export const getUnscaledClientRect = (node) => {
  const rect = node?.getBoundingClientRect?.()
  if (!rect) {
    return rect
  }
  const scale = getMeasureScale(node)
  if (scale === 1) {
    return rect
  }
  return {
    x: (rect.x ?? rect.left) / scale,
    y: (rect.y ?? rect.top) / scale,
    left: rect.left / scale,
    top: rect.top / scale,
    right: rect.right / scale,
    bottom: rect.bottom / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }
}
