export const handleCellCopy = (e, textToCopy, tooltipTexts) => {
  e.preventDefault()
  e.stopPropagation()

  const currentElement = e.currentTarget
  const textarea = document.createElement('textarea')

  textarea.value = textToCopy
  textarea.className = 'hidden-clipboard-textarea'
  document.body.appendChild(textarea)

  try {
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const successful = document.execCommand('copy')

    if (successful) {
      currentElement.classList.add('active')
      updateTooltipContent(currentElement, tooltipTexts.COPIED)

      // Reset after delay
      setTimeout(() => {
        if (currentElement && document.body.contains(currentElement)) {
          updateTooltipContent(currentElement, tooltipTexts.DEFAULT)
          currentElement.classList.remove('active')
        }
      }, 1500)
    } else {
      console.error('Failed to copy cell value')
      updateTooltipContent(currentElement, tooltipTexts.ERROR)

      setTimeout(() => {
        if (currentElement && document.body.contains(currentElement)) {
          updateTooltipContent(currentElement, tooltipTexts.DEFAULT)
        }
      }, 1500)
    }

    return successful
  } catch (err) {
    console.error('Failed to copy cell value:', err)
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

export const updateTooltipContent = (element, content) => {
  if (!element) return

  const tooltipId = element.getAttribute('data-tooltip-id')
  element.removeAttribute('data-tooltip-id')
  element.setAttribute('data-tooltip-content', content)

  // Re-apply ID after delay to force re-render
  setTimeout(() => {
    if (element && document.body.contains(element)) {
      element.setAttribute('data-tooltip-id', tooltipId)
    }
  }, 10)
}

export const setupCopyableCell = (element, tooltipId, defaultContent) => {
  if (!element) return

  element.setAttribute('data-tooltip-id', tooltipId)
  element.setAttribute('data-tooltip-content', defaultContent)
}
