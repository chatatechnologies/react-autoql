import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { SaveStatus } from '../workspace/SaveStatus'

// The status is what tells someone it's safe to leave the page: one control that says what state the report is in
// ("saved" says when, in the tooltip) and saves at once when pressed; a failed save says so and tries again, and a
// report changed in another tab reloads instead of saving.

const status = () => screen.getByRole('status')
const button = () => screen.getByRole('button')
const noop = () => {}

describe('SaveStatus', () => {
  it('says the report is saved, and when', () => {
    const savedAt = new Date(2026, 8, 25, 15, 42).toISOString()
    render(<SaveStatus state='saved' savedAt={savedAt} onSave={noop} onReload={noop} />)
    expect(status().textContent).toBe('Saved')
    const time = new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    expect(button().getAttribute('title')).toBe(`Saved at ${time}`)
  })

  it('says all changes are saved when it can’t say when', () => {
    const { rerender } = render(<SaveStatus state='saved' savedAt={null} onSave={noop} onReload={noop} />)
    expect(button().getAttribute('title')).toBe('All changes are saved')
    rerender(<SaveStatus state='saved' savedAt='not a date' onSave={noop} onReload={noop} />)
    expect(button().getAttribute('title')).toBe('All changes are saved')
  })

  it('is one control, not a status beside a Save button', () => {
    render(<SaveStatus state='saving' savedAt={null} onSave={noop} onReload={noop} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(status().contains(button())).toBe(true)
    expect(status().getAttribute('aria-live')).toBe('polite')
  })

  it('shows a pending edit as saving, and saves it at once when pressed', () => {
    const onSave = jest.fn()
    render(<SaveStatus state='saving' savedAt={null} onSave={onSave} onReload={noop} />)
    expect(status().textContent).toBe('Saving…')
    expect(button().getAttribute('title')).toBe('Save now (⌘S / Ctrl+S)')
    fireEvent.click(button())
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('says plainly when the report is not saved, and tries again when pressed', () => {
    const onSave = jest.fn()
    render(<SaveStatus state='failed' savedAt={null} onSave={onSave} onReload={noop} />)
    expect(button().textContent).toBe('Not saved · Try again')
    expect(button().getAttribute('title')).toBe('Try saving again (⌘S / Ctrl+S)')
    fireEvent.click(button())
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('reloads, not saves, when the report was changed in another tab', () => {
    const onSave = jest.fn()
    const onReload = jest.fn()
    render(<SaveStatus state='conflict' savedAt={null} onSave={onSave} onReload={onReload} />)
    expect(button().textContent).toBe('Changed elsewhere · Reload')
    expect(button().getAttribute('title')).toBe('Open the latest saved version')
    fireEvent.click(button())
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('gives its state to the stylesheet, and shows one it doesn’t know as saved', () => {
    const { rerender } = render(<SaveStatus state='failed' savedAt={null} onSave={noop} onReload={noop} />)
    expect(screen.getByTestId('reports-save-status').getAttribute('data-state')).toBe('failed')
    rerender(<SaveStatus state='unknown' savedAt={null} onSave={noop} onReload={noop} />)
    expect(screen.getByTestId('reports-save-status').getAttribute('data-state')).toBe('saved')
    expect(button().textContent).toBe('Saved')
  })
})
