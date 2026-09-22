import React, { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { ConfirmPopover } from '../ConfirmPopover'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './ThreadSwitcher.scss'

/**
 * The phone-sized replacement for the horizontal tab strips in the Data Messenger
 * (sessions) and the Data Agent (threads).
 *
 * A strip of fixed-width chips that scrolls horizontally works on a desktop drawer
 * and falls apart on a phone: about one and a half chips fit, the scrollbar is
 * hidden and there is no hover, so nothing on screen says the other chats exist.
 * Every chat app that lets you keep several conversations solves this the same way
 * - the current one's title, and a menu holding the rest - so that is what this is.
 *
 * Both messengers keep their strip above the breakpoint and render this below it;
 * the strip is still the better UI when there is room for it.
 */
export const ThreadSwitcher = ({
  items,
  activeId,
  onSelect,
  onClose,
  onNew,
  onCloseAll,
  canAddNew,
  newLabel,
  closeAllLabel,
  confirmTitle,
  confirmText,
  tooltipID,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])

  // Escape closes, and focus goes back to the trigger - otherwise it is left on a
  // row that no longer exists and the next Tab starts from the top of the drawer.
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen, close])

  // A chat closed from inside the menu leaves the menu open, so you can close
  // several in a row - but closing the last one but one leaves nothing to switch
  // between, so the menu has no reason to stay.
  useEffect(() => {
    if (isOpen && items.length <= 1) {
      close()
    }
  }, [isOpen, items.length, close])

  const activeItem = items.find((item) => item.id === activeId) ?? items[0]

  const selectItem = (id) => {
    onSelect(id)
    close()
  }

  const addNew = () => {
    onNew()
    close()
  }

  return (
    <ErrorBoundary>
      <div className='react-autoql-thread-switcher' ref={rootRef}>
        <button
          ref={triggerRef}
          type='button'
          className={`react-autoql-thread-switcher-trigger${isOpen ? ' is-open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup='listbox'
          aria-expanded={isOpen}
          // Only one chat means there is nothing to switch to. The trigger stays
          // put rather than collapsing, so the title doesn't jump around as chats
          // come and go - it just stops being a button.
          disabled={items.length <= 1}
        >
          <span className='react-autoql-thread-switcher-trigger-title'>{activeItem?.title}</span>
          {items.length > 1 && <Icon type='caret-down' className='react-autoql-thread-switcher-caret' />}
        </button>

        <button
          type='button'
          className='react-autoql-thread-switcher-new'
          onClick={addNew}
          disabled={!canAddNew}
          aria-label={newLabel}
          data-tooltip-content={newLabel}
          data-tooltip-id={tooltipID}
        >
          <Icon type='plus' />
        </button>

        {isOpen && (
          <>
            {/* Catches the tap that dismisses the menu. It covers the messenger
                rather than the viewport, so a tap outside the drawer still reaches
                whatever the drawer is sitting on. */}
            <div className='react-autoql-thread-switcher-scrim' onClick={close} />
            <div className='react-autoql-thread-switcher-menu' role='listbox'>
              <div className='react-autoql-thread-switcher-list'>
                {items.map((item) => {
                  const isActive = item.id === activeId

                  return (
                    <div
                      key={item.id}
                      role='option'
                      tabIndex={0}
                      aria-selected={isActive}
                      className={`react-autoql-thread-switcher-item${isActive ? ' is-active' : ''}`}
                      onClick={() => selectItem(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          selectItem(item.id)
                        }
                      }}
                    >
                      <span className='react-autoql-thread-switcher-item-dot' aria-hidden='true' />
                      {/* A full row is wide enough that most titles fit outright,
                          which is the whole point of the vertical list. */}
                      <span className='react-autoql-thread-switcher-item-title'>{item.title}</span>
                      {item.canClose && (
                        <button
                          type='button'
                          className='react-autoql-thread-switcher-item-close'
                          aria-label={item.closeLabel}
                          onClick={(event) => {
                            // Without this the click bubbles to the row and
                            // activates the chat we are about to unmount.
                            event.stopPropagation()
                            onClose(item.id)
                          }}
                        >
                          <Icon type='close' />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Close all lives down here rather than in the toolbar: on a phone
                  the toolbar has room for the title and one button, and a
                  destructive action is the last thing that should win that spot.
                  Inside the menu it also sits next to the list it empties. */}
              {!!onCloseAll && items.length > 1 && (
                <div className='react-autoql-thread-switcher-footer'>
                  <ConfirmPopover
                    className='react-autoql-thread-switcher-close-all-wrapper'
                    popoverParentElement={rootRef.current}
                    title={confirmTitle}
                    text={confirmText}
                    confirmText='Close all'
                    backText='Cancel'
                    danger
                    onConfirm={() => {
                      onCloseAll()
                      close()
                    }}
                    positions={['top', 'bottom', 'left', 'right']}
                    align='center'
                    tooltipID={tooltipID}
                  >
                    <button type='button' className='react-autoql-thread-switcher-close-all'>
                      <Icon type='close-circle' />
                      <span>{closeAllLabel}</span>
                    </button>
                  </ConfirmPopover>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

ThreadSwitcher.propTypes = {
  // canClose mirrors whether the strip would show a close button on that tab, and
  // closeLabel is its aria-label ("Close Q3 revenue").
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      canClose: PropTypes.bool,
      closeLabel: PropTypes.string,
    }),
  ),
  activeId: PropTypes.string,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
  onNew: PropTypes.func,
  // Omit to leave the close-all row out entirely.
  onCloseAll: PropTypes.func,
  canAddNew: PropTypes.bool,
  newLabel: PropTypes.string,
  closeAllLabel: PropTypes.string,
  confirmTitle: PropTypes.string,
  confirmText: PropTypes.string,
  tooltipID: PropTypes.string,
}

ThreadSwitcher.defaultProps = {
  items: [],
  activeId: undefined,
  onSelect: () => {},
  onClose: () => {},
  onNew: () => {},
  onCloseAll: undefined,
  canAddNew: true,
  newLabel: 'New chat',
  closeAllLabel: 'Close all chats',
  confirmTitle: 'Close all chats?',
  confirmText: 'Your conversations will be cleared and a new chat will be started.',
  tooltipID: undefined,
}

export default ThreadSwitcher
