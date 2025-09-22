/**
 * Utilities for handling copy functionality in ChataTable
 */

/**
 * Copy text to clipboard and manage tooltip feedback
 * @param {Event} e - Context menu event
 * @param {string} textToCopy - The text to copy to clipboard
 * @param {Object} tooltipTexts - Object containing tooltip text constants
 * @returns {boolean} - Whether copy was successful
 */
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
      // Add active class to highlight the cell
      currentElement.classList.add('active')

      // Update tooltip to show copy success
      updateTooltipContent(currentElement, tooltipTexts.COPIED)

      // Reset the tooltip and cell appearance after delay
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

/**
 * Update tooltip content with forced re-render
 * @param {HTMLElement} element - The element with the tooltip
 * @param {string} content - The new tooltip content
 */
export const updateTooltipContent = (element, content) => {
  if (!element) return

  // Force re-render of tooltip by temporarily removing and re-adding the attribute
  const tooltipId = element.getAttribute('data-tooltip-id')
  element.removeAttribute('data-tooltip-id')

  // Set the tooltip content
  element.setAttribute('data-tooltip-content', content)

  // Re-apply the tooltip ID after a brief delay to force a re-render
  setTimeout(() => {
    if (element && document.body.contains(element)) {
      element.setAttribute('data-tooltip-id', tooltipId)
    }
  }, 10)
}

/**
 * Set up tooltip attributes for a copyable cell
 * @param {HTMLElement} element - The cell element
 * @param {string} tooltipId - The ID of the tooltip
 * @param {string} defaultContent - The default tooltip content
 */
export const setupCopyableCell = (element, tooltipId, defaultContent) => {
  if (!element) return

  element.setAttribute('data-tooltip-id', tooltipId)
  element.setAttribute('data-tooltip-content', defaultContent)
}
