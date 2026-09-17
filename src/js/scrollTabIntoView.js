// Both messengers lay their tabs out at a fixed width and scroll the strip
// horizontally, so a tab opened while the strip is full lands off the right edge with
// nothing to say it exists. Shared by the Data Messenger's sessions and the Data
// Agent's threads so the two keep behaving the same way.

// The selected tab animates from 148px to 188px over 0.2s. Measured while that
// transition is running, a tab reads narrower than it will end up, so the strip stops
// short of showing all of it - hence the second pass once the width has settled.
const TAB_WIDTH_TRANSITION = 220

// Keeps a little of the neighbouring tab in view, so a scrolled strip still looks
// like it continues rather than ending exactly at the tab's edge.
const EDGE_MARGIN = 8

const scrollOnce = (list, tab) => {
  if (!list || !tab || !list.clientWidth) {
    return
  }

  const left = tab.offsetLeft - EDGE_MARGIN
  const right = tab.offsetLeft + tab.offsetWidth + EDGE_MARGIN
  const viewLeft = list.scrollLeft
  const viewRight = viewLeft + list.clientWidth

  // Only move when the tab is actually out of view: a tab already on screen that
  // happens to sit near an edge shouldn't drag the strip around under the cursor.
  if (left < viewLeft) {
    list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  } else if (right > viewRight) {
    list.scrollTo({ left: right - list.clientWidth, behavior: 'smooth' })
  }
}

/**
 * Scrolls a horizontally scrolling tab strip so the given tab is visible.
 *
 * @param {HTMLElement} list the scrolling strip
 * @param {HTMLElement} tab the tab to reveal
 * @returns {Function} cancels the pending follow-up pass; call it on unmount
 */
export const scrollTabIntoView = (list, tab) => {
  scrollOnce(list, tab)

  const timeout = setTimeout(() => scrollOnce(list, tab), TAB_WIDTH_TRANSITION)
  return () => clearTimeout(timeout)
}

export default scrollTabIntoView
