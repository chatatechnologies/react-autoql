import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ReportModal } from '../workspace/ReportModal'

const open = (props = {}) =>
  render(
    <ReportModal
      title='New report'
      description='Start from a question.'
      onClose={jest.fn()}
      headerExtra={
        <select aria-label='Dashboard'>
          <option>One</option>
        </select>
      }
      actions={
        <button type='button' data-variant='primary'>
          Create report
        </button>
      }
      {...props}
    >
      <input aria-label='Question' />
    </ReportModal>,
  )

describe('ReportModal', () => {
  it('is a labelled dialog at the end of the page, its focus starting on the body’s first field', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'New report' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Start from a question.')
    expect(dialog.closest('.react-autoql-reports-layer').parentElement).toBe(document.body)
    // Not the header's own select or its close button.
    expect(screen.getByRole('textbox', { name: 'Question' })).toHaveFocus()
  })

  it('starts on what it’s asked to', () => {
    const first = React.createRef()
    render(
      <ReportModal title='Tiles' onClose={jest.fn()} initialFocus={first}>
        <input aria-label='Other' />
        <input aria-label='Wanted' ref={first} />
      </ReportModal>,
    )
    expect(screen.getByRole('textbox', { name: 'Wanted' })).toHaveFocus()
  })

  it('closes on Escape, its close button and the backdrop — not while busy', () => {
    const onClose = jest.fn()
    const { rerender } = open({ onClose })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.mouseDown(document.querySelector('.react-autoql-reports-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(3)

    rerender(
      <ReportModal title='New report' onClose={onClose} busy>
        <input aria-label='Question' />
      </ReportModal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.mouseDown(document.querySelector('.react-autoql-reports-modal-backdrop'))
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('keeps Tab inside it', () => {
    open()
    const select = screen.getByRole('combobox', { name: 'Dashboard' })
    const last = screen.getByRole('button', { name: 'Create report' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(select).toHaveFocus()
    fireEvent.keyDown(select, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('gives focus back to where it was when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = open()
    expect(opener).not.toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
