export const getParameterByName = (
  parameterName,
  url = window.location.href
) => {
  const processedParameterName = parameterName.replace(/[\[\]]/g, '\\$&')
  const regex = new RegExp(`[?&]${processedParameterName}(=([^&#]*)|&|#|$)`)

  const results = regex.exec(url)
  if (!results) {
    return null
  }
  if (!results[2]) {
    return ''
  }
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}
