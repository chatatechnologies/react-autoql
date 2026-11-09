import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FilterLockField } from '../components/FilterLockField'

// A report's filter lock in the panel and the template dialog (RW-351). The popover is mocked: what's pinned here is
// what the field does around it — the host's list loaded when it first opens, the locks it's handed session-scoped,
// and Escape closing the popover without reaching the dialog or builder around it.

const mockPopover = { props: null }
jest.mock('../../FilterLockPopover', () => ({
  FilterLockPopover: (props) => {
    mockPopover.props = props
    return (
      <div data-test='popover' data-open={String(!!props.isOpen)}>
        {props.children}
      </div>
    )
  },
}))

const BROWN = { key: 'household', value: 'Brown Family', filter_type: 'include' }

const setup = (props = {}) => {
  const onChange = jest.fn()
  const outerKeyDown = jest.fn()
  render(
    <div onKeyDown={outerKeyDown}>
      <FilterLockField locks={[BROWN]} labels={{ none: 'All households' }} onChange={onChange} {...props} />
    </div>,
  )
  return { onChange, outerKeyDown }
}
const open = () => act(async () => fireEvent.click(screen.getByTestId('report-filter-lock-change')))

beforeEach(() => {
  mockPopover.props = null
})

describe('FilterLockField', () => {
  it('shows the lock, or the host’s word for none', () => {
    setup({ locks: [] })
    expect(screen.getByTestId('report-filter-lock-value')).toHaveTextContent('All households')
  })

  it('hands the popover the report’s locks session-scoped, with no Persist toggle', () => {
    setup()
    expect(screen.getByTestId('report-filter-lock-value')).toHaveTextContent('Brown Family')
    expect(mockPopover.props.seedFilters).toStrictEqual([{ ...BROWN, isSession: true }])
    expect(mockPopover.props.persistNewFilters).toBe(false)
    expect(mockPopover.props.showPersistToggle).toBe(false)
  })

  it('loads the host’s list the first time it opens, and lists it', async () => {
    const loadSuggestions = jest.fn(() => Promise.resolve(['Brown Family', 'Nguyen Family']))
    setup({ loadSuggestions })
    expect(mockPopover.props.suggestionList).toStrictEqual([])
    await open()
    expect(loadSuggestions).toHaveBeenCalledTimes(1)
    expect(mockPopover.props.suggestionList).toStrictEqual(['Brown Family', 'Nguyen Family'])
    expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
  })

  it('passes on a change, but not the popover saying what it started from', () => {
    const { onChange } = setup()
    act(() => mockPopover.props.onChange([{ ...BROWN, isSession: true }]))
    expect(onChange).not.toHaveBeenCalled()
    act(() => mockPopover.props.onChange([]))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('closes the popover on Escape without it reaching what the field is in', async () => {
    const { outerKeyDown } = setup()
    await open()
    fireEvent.keyDown(screen.getByTestId('report-filter-lock-change'), { key: 'Escape' })
    expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'false')
    expect(outerKeyDown).not.toHaveBeenCalled()

    // Closed, Escape is the dialog's again.
    fireEvent.keyDown(screen.getByTestId('report-filter-lock-change'), { key: 'Escape' })
    expect(outerKeyDown).toHaveBeenCalledTimes(1)
  })

  it('gives Change… the focus back once the list has loaded, so Escape still closes the popover', async () => {
    let loaded
    setup({ loadSuggestions: () => new Promise((resolve) => (loaded = resolve)) })
    const change = screen.getByTestId('report-filter-lock-change')
    act(() => change.focus())
    fireEvent.click(change)
    // Disabled while the list loads, it loses the focus to the page in a browser (here, by way of a field that goes).
    const gone = document.createElement('input')
    document.body.appendChild(gone)
    act(() => gone.focus())
    act(() => gone.remove())
    expect(document.activeElement).toBe(document.body)

    await act(async () => loaded(['Brown Family']))
    expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true')
    expect(document.activeElement).toBe(change)
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'false')
  })

  it('leaves the focus where it went while the list loaded', async () => {
    let loaded
    setup({ loadSuggestions: () => new Promise((resolve) => (loaded = resolve)) })
    const change = screen.getByTestId('report-filter-lock-change')
    act(() => change.focus())
    fireEvent.click(change)
    const elsewhere = document.createElement('input')
    document.body.appendChild(elsewhere)
    act(() => elsewhere.focus())

    await act(async () => loaded([]))
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })
})
