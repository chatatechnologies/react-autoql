import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { ThreadSwitcher } from '../ThreadSwitcher'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { scrollTabIntoView } from '../../js/scrollTabIntoView'

import './SessionTabs.scss'

/**
 * The tab strip above a messenger's transcript: the Data Messenger's chat sessions
 * and the Data Agent's threads are the same control over different nouns, so they
 * are the same component. It owns the whole responsive story - above the phone
 * breakpoint the horizontal strip, below it the ThreadSwitcher dropdown, which the
 * two were already sharing.
 *
 * Sessions read as a segmented control: the whole strip is one sunken, rounded track
 * and the selected item is a raised chip floating inside it. Nothing connects a tab
 * to the thread below, so the bar can sit anywhere in the panel.
 */
export const SessionTabs = ({
  items = [],
  activeId,
  highlightId,
  onSelect,
  onClose,
  onNew,
  canAddNew = true,
  newLabel,
  closeItemTooltip,
  tooltipID,
  isSmallScreen = false,
}) => {
  const listRef = useRef(null)

  // Reveal the selected tab: picked (or opened) while the strip is already full, it
  // would otherwise sit off the right edge with nothing to say it exists.
  useEffect(() => {
    const list = listRef.current
    const tab = list?.querySelector('.react-autoql-session-tab.is-active')

    if (!list || !tab) {
      return undefined
    }

    return scrollTabIntoView(list, tab)
  }, [activeId, items.length, isSmallScreen])

  // On a phone the strip becomes a dropdown: one and a half chips fit at that width,
  // and with no hover and a hidden scrollbar nothing says the other items are there.
  if (isSmallScreen) {
    return (
      <ThreadSwitcher
        items={items}
        activeId={activeId}
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
        canAddNew={canAddNew}
        newLabel={newLabel}
        tooltipID={tooltipID}
      />
    )
  }

  const selectItem = (event, id) => {
    if (event.type === 'keydown') {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
    }

    onSelect?.(id)
  }

  return (
    <ErrorBoundary>
      <div className='react-autoql-session-tabs'>
        <div className='react-autoql-session-tab-list' role='tablist' ref={listRef}>
          {items.map((item) => {
            const isActive = item.id === activeId

            return (
              <div
                key={item.id}
                role='tab'
                tabIndex={0}
                aria-selected={isActive}
                className={`react-autoql-session-tab${isActive ? ' is-active' : ''}${
                  item.id === highlightId ? ' is-new' : ''
                }`}
                onClick={(event) => selectItem(event, item.id)}
                onKeyDown={(event) => selectItem(event, item.id)}
              >
                <span className='react-autoql-session-tab-dot' aria-hidden='true' />
                {/* Titles are ellipsised, so the full text has to be reachable
                    somewhere - react-tooltip reads it off the anchor. */}
                <span
                  className='react-autoql-session-tab-title'
                  data-tooltip-content={item.title}
                  data-tooltip-id={tooltipID}
                >
                  {item.title}
                </span>
                {item.canClose && (
                  <span
                    className='react-autoql-session-tab-close'
                    role='button'
                    aria-label={item.closeLabel}
                    // Without this the click bubbles to the tab and activates the
                    // one we're about to unmount.
                    onClick={(event) => {
                      event.stopPropagation()
                      onClose?.(item.id)
                    }}
                    data-tooltip-content={closeItemTooltip}
                    data-tooltip-id={tooltipID}
                  >
                    <Icon type='close' />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Trails the last tab rather than being pinned to the far edge - the strip
            only grows to fit its tabs, so with a few of them the "+" is right where
            the row ends, and once they fill the track it lands against the right
            side anyway. */}
        <button
          className='react-autoql-session-tab-new'
          onClick={onNew}
          disabled={!canAddNew}
          aria-label={newLabel}
          data-tooltip-content={newLabel}
          data-tooltip-id={tooltipID}
        >
          <Icon type='plus' />
        </button>
      </div>
    </ErrorBoundary>
  )
}

SessionTabs.propTypes = {
  // canClose is whether this tab gets a close button, and closeLabel is its
  // aria-label ("Close Q3 revenue"). Same shape ThreadSwitcher takes.
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      canClose: PropTypes.bool,
      closeLabel: PropTypes.string,
    }),
  ),
  activeId: PropTypes.string,
  // Flashes a tab once, so opening one is visible even when the transcript below
  // looks the same either way. The caller clears it when the flash is done.
  highlightId: PropTypes.string,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
  onNew: PropTypes.func,
  canAddNew: PropTypes.bool,
  newLabel: PropTypes.string,
  closeItemTooltip: PropTypes.string,
  tooltipID: PropTypes.string,
  isSmallScreen: PropTypes.bool,
}

export default SessionTabs
