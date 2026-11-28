// Text cut to `max` characters (code points, as the report service counts them), with an ellipsis when it had more.
export const clipped = (text, max) => {
  const points = Array.from(String(text))
  return points.length > max ? `${points.slice(0, Math.max(max - 1, 1)).join('')}…` : String(text)
}
