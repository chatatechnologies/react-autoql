export default function safeGetBBox(el) {
  if (!el) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const fn = el.getBBox
  if (typeof fn !== 'function') {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  try {
    const bbox = fn.call(el)
    return {
      x: typeof bbox?.x === 'number' ? bbox.x : 0,
      y: typeof bbox?.y === 'number' ? bbox.y : 0,
      width: typeof bbox?.width === 'number' ? bbox.width : 0,
      height: typeof bbox?.height === 'number' ? bbox.height : 0,
    }
  } catch (e) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
}
