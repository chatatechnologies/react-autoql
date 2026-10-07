import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { SessionTabs } from './index'

const items = [
  { id: 'a', title: 'First chat', canClose: true, closeLabel: 'Close First chat' },
  { id: 'b', title: 'Second chat', canClose: true, closeLabel: 'Close Second chat' },
]

const renderTabs = (props) =>
  render(
    <SessionTabs
      items={items}
      activeId='a'
      onSelect={() => {}}
      onClose={() => {}}
      onNew={() => {}}
      newLabel='New chat'
      closeItemTooltip='Close chat'
      {...props}
    />,
  )

const tabs = () => document.querySelectorAll('.react-autoql-session-tab')

describe('SessionTabs', () => {
  test('renders a tab per item and marks the active one', () => {
    renderTabs()

    expect(tabs()).toHaveLength(2)
    expect(tabs()[0]).toHaveClass('is-active')
    expect(tabs()[1]).not.toHaveClass('is-active')
    expect(screen.getByText('Second chat')).toBeInTheDocument()
  })

  test('clicking a tab selects it', () => {
    const onSelect = jest.fn()
    renderTabs({ onSelect })

    fireEvent.click(tabs()[1])
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  test('Enter and Space select a focused tab', () => {
    const onSelect = jest.fn()
    renderTabs({ onSelect })

    fireEvent.keyDown(tabs()[1], { key: 'Enter' })
    fireEvent.keyDown(tabs()[1], { key: ' ' })
    fireEvent.keyDown(tabs()[1], { key: 'a' })

    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  test('closing a tab does not also select it', () => {
    const onSelect = jest.fn()
    const onClose = jest.fn()
    renderTabs({ onSelect, onClose })

    fireEvent.click(screen.getByLabelText('Close Second chat'))

    expect(onClose).toHaveBeenCalledWith('b')
    expect(onSelect).not.toHaveBeenCalled()
  })

  // With "Close all" gone, this is the only way to close a background thread from the
  // keyboard - so it has to be a real, focusable button.
  test('the close control is a keyboard-reachable button', () => {
    renderTabs()

    const close = screen.getByRole('button', { name: 'Close Second chat' })
    expect(close.tagName).toBe('BUTTON')
    expect(close).not.toHaveAttribute('tabindex', '-1')
  })

  // The tab's own handler takes Enter/Space and preventDefaults them, which would cancel
  // the button's click and select the tab instead.
  test('keys pressed on the close button do not reach the tab', () => {
    const onSelect = jest.fn()
    renderTabs({ onSelect })

    fireEvent.keyDown(screen.getByLabelText('Close Second chat'), { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
  })

  test('a tab with canClose false has no close button', () => {
    renderTabs({ items: [{ id: 'a', title: 'Only chat', canClose: false, closeLabel: 'Close Only chat' }] })

    expect(screen.queryByLabelText('Close Only chat')).not.toBeInTheDocument()
  })

  test('the new button is disabled at the ceiling', () => {
    renderTabs({ canAddNew: false })
    expect(screen.getByLabelText('New chat')).toBeDisabled()
  })

  test('highlightId flashes just that tab', () => {
    renderTabs({ highlightId: 'b' })

    expect(tabs()[0]).not.toHaveClass('is-new')
    expect(tabs()[1]).toHaveClass('is-new')
  })

  test('a small screen gets the dropdown instead of the strip', () => {
    renderTabs({ isSmallScreen: true })

    expect(tabs()).toHaveLength(0)
    expect(document.querySelector('.react-autoql-thread-switcher')).toBeTruthy()
    // The one control that survives the swap - it's the action worth keeping at
    // any width.
    expect(screen.getByLabelText('New chat')).toBeInTheDocument()
  })
})
