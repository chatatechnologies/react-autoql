import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReportTabs } from '../workspace/ReportTabs'
import { DEFAULT_STORAGE_PREFIX, TAB_WIDTHS_STORAGE_KEY, TABS_STORAGE_KEY } from '../workspace/reportsConstants'
import {
  loadOpenTabs,
  loadTabWidths,
  MIN_TAB_WIDTH,
  saveOpenTabs,
  saveTabWidths,
  widthsFor,
  withTabClosed,
  withTabOpen,
} from '../workspace/tabs'

// The tabs are remembered per data source, under the host's storage prefix, so a host that clears its own keys on
// sign-out forgets them; what's stored is read defensively (it may be old or hand-edited). Closing the tab that's
// shown moves to its neighbour, and closing the last one goes home. A width a tab was dragged to is kept only while
// the tab is open. The strip itself: which one is shown (for assistive tech too), that closing is its own action
// (the ×, or a middle click) and not a select, that an unsaved report's tab says so, and dragging an edge.

const PREFIX = 'chata.'
const TABS_KEY = `${PREFIX}${TABS_STORAGE_KEY}`
const WIDTHS_KEY = `${PREFIX}${TAB_WIDTHS_STORAGE_KEY}`

// The wealth app's sign-out (clearSession): every key under its prefix goes.
const signOut = () => {
  const doomed = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(PREFIX)) {
      doomed.push(key)
    }
  }
  doomed.forEach((key) => window.localStorage.removeItem(key))
}

afterEach(() => {
  window.localStorage.clear()
  jest.restoreAllMocks()
})

describe('remembered tabs', () => {
  it('keeps each data source’s tabs apart, in order', () => {
    saveOpenTabs(PREFIX, 'p1', ['a', 'b'])
    saveOpenTabs(PREFIX, 'p2', ['c'])
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual(['a', 'b'])
    expect(loadOpenTabs(PREFIX, 'p2')).toEqual(['c'])
    expect(loadOpenTabs(PREFIX, 'p3')).toEqual([])
  })

  it('forgets a data source with no tabs, and the key once none is left', () => {
    saveOpenTabs(PREFIX, 'p1', ['a'])
    saveOpenTabs(PREFIX, 'p2', ['c'])
    saveOpenTabs(PREFIX, 'p1', [])
    expect(JSON.parse(window.localStorage.getItem(TABS_KEY) ?? 'null')).toEqual({ p2: ['c'] })
    saveOpenTabs(PREFIX, 'p2', [])
    expect(window.localStorage.getItem(TABS_KEY)).toBeNull()
  })

  it('reads what it can from a damaged or odd value', () => {
    window.localStorage.setItem(TABS_KEY, '{not json')
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual([])
    window.localStorage.setItem(TABS_KEY, JSON.stringify(['a']))
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual([])
    window.localStorage.setItem(TABS_KEY, JSON.stringify({ p1: ['a', 7, '', 'a', null, 'b'], p2: 'c' }))
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual(['a', 'b'])
    expect(loadOpenTabs(PREFIX, 'p2')).toEqual([])
  })

  it('is forgotten when signing out', () => {
    saveOpenTabs(PREFIX, 'p1', ['a'])
    signOut()
    expect(window.localStorage.getItem(TABS_KEY)).toBeNull()
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual([])
  })

  it('keeps the 30 most recent', () => {
    const ids = Array.from({ length: 35 }, (_, i) => `r${i}`)
    saveOpenTabs(PREFIX, 'p1', ids)
    expect(JSON.parse(window.localStorage.getItem(TABS_KEY)).p1).toEqual(ids.slice(5))
    window.localStorage.setItem(TABS_KEY, JSON.stringify({ p1: ids }))
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual(ids.slice(5))
  })

  it('keeps the tabs of a host with no data source under an empty id', () => {
    saveOpenTabs(PREFIX, '', ['a'])
    expect(loadOpenTabs(PREFIX, '')).toEqual(['a'])
    expect(JSON.parse(window.localStorage.getItem(TABS_KEY))).toEqual({ '': ['a'] })
  })
})

describe('where tabs are remembered', () => {
  it('reads and writes the wealth app’s own keys, in its format, under its prefix', () => {
    saveOpenTabs('chata.', 'p1', ['a', 'b'])
    saveTabWidths('chata.', 'p1', { a: 240 })
    expect(window.localStorage.getItem('chata.reportTabs')).toBe('{"p1":["a","b"]}')
    expect(window.localStorage.getItem('chata.reportTabWidths')).toBe('{"p1":{"a":240}}')
    expect(window.localStorage.length).toBe(2)

    window.localStorage.setItem('chata.reportTabs', '{"p9":["x","y"]}')
    window.localStorage.setItem('chata.reportTabWidths', '{"p9":{"x":180}}')
    expect(loadOpenTabs('chata.', 'p9')).toEqual(['x', 'y'])
    expect(loadTabWidths('chata.', 'p9')).toEqual({ x: 180 })
  })

  it('keeps each prefix’s tabs apart', () => {
    saveOpenTabs('chata.', 'p1', ['a'])
    saveOpenTabs(DEFAULT_STORAGE_PREFIX, 'p1', ['b'])
    expect(loadOpenTabs('chata.', 'p1')).toEqual(['a'])
    expect(loadOpenTabs(DEFAULT_STORAGE_PREFIX, 'p1')).toEqual(['b'])
  })

  it('remembers nothing without a prefix', () => {
    saveOpenTabs(null, 'p1', ['a'])
    saveTabWidths(undefined, 'p1', { a: 240 })
    expect(window.localStorage.length).toBe(0)

    window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ p1: ['a'] }))
    window.localStorage.setItem(TAB_WIDTHS_STORAGE_KEY, JSON.stringify({ p1: { a: 240 } }))
    expect(loadOpenTabs(null, 'p1')).toEqual([])
    expect(loadTabWidths(undefined, 'p1')).toEqual({})
  })

  it('carries on when storage is full or blocked', () => {
    jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveOpenTabs(PREFIX, 'p1', ['a'])).not.toThrow()
    expect(() => saveTabWidths(PREFIX, 'p1', { a: 240 })).not.toThrow()

    jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadOpenTabs(PREFIX, 'p1')).toEqual([])
    expect(loadTabWidths(PREFIX, 'p1')).toEqual({})
  })
})

describe('opening and closing tabs', () => {
  it('opens a report at the end, or leaves an open one where it is', () => {
    expect(withTabOpen(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    const tabs = ['a', 'b']
    expect(withTabOpen(tabs, 'a')).toBe(tabs)
  })

  it('shows the tab to the right after closing the one shown, or the one to the left at the end', () => {
    expect(withTabClosed(['a', 'b', 'c'], 'b', 'b')).toEqual({ tabs: ['a', 'c'], shown: 'c' })
    expect(withTabClosed(['a', 'b', 'c'], 'c', 'c')).toEqual({ tabs: ['a', 'b'], shown: 'b' })
  })

  it('goes home after closing the only tab', () => {
    expect(withTabClosed(['a'], 'a', 'a')).toEqual({ tabs: [], shown: null })
  })

  it('keeps showing what was shown when another tab closes', () => {
    expect(withTabClosed(['a', 'b'], 'a', 'b')).toEqual({ tabs: ['b'], shown: 'b' })
    expect(withTabClosed(['a', 'b'], 'a', null)).toEqual({ tabs: ['b'], shown: null })
    const tabs = ['a']
    expect(withTabClosed(tabs, 'x', 'a')).toEqual({ tabs, shown: 'a' })
  })
})

describe('remembered tab widths', () => {
  it('keeps each data source’s widths, whole pixels', () => {
    saveTabWidths(PREFIX, 'p1', { a: 240, b: 120.4 })
    saveTabWidths(PREFIX, 'p2', { c: 300 })
    expect(loadTabWidths(PREFIX, 'p1')).toEqual({ a: 240, b: 120 })
    expect(loadTabWidths(PREFIX, 'p2')).toEqual({ c: 300 })
    expect(loadTabWidths(PREFIX, 'p3')).toEqual({})
  })

  it('forgets a data source with none, and the key once none is left', () => {
    saveTabWidths(PREFIX, 'p1', { a: 240 })
    saveTabWidths(PREFIX, 'p1', {})
    expect(window.localStorage.getItem(WIDTHS_KEY)).toBeNull()
  })

  it('ignores widths it can’t use', () => {
    window.localStorage.setItem(WIDTHS_KEY, JSON.stringify({ p1: { a: 50, b: '200', c: 9999, d: 180 }, p2: [1] }))
    expect(loadTabWidths(PREFIX, 'p1')).toEqual({ d: 180 })
    expect(loadTabWidths(PREFIX, 'p2')).toEqual({})
    window.localStorage.setItem(WIDTHS_KEY, 'nope')
    expect(loadTabWidths(PREFIX, 'p1')).toEqual({})
  })

  it('is forgotten when signing out', () => {
    saveTabWidths(PREFIX, 'p1', { a: 240 })
    signOut()
    expect(window.localStorage.getItem(WIDTHS_KEY)).toBeNull()
  })

  it('keeps only the open tabs’ widths, as the same object when nothing goes', () => {
    const widths = { a: 240, b: 120 }
    expect(widthsFor(widths, ['a', 'b', 'c'])).toBe(widths)
    expect(widthsFor(widths, ['b'])).toEqual({ b: 120 })
    expect(widthsFor(widths, [])).toEqual({})
  })
})

// ---------------------------------------------------------------- the strip

const TABS = [
  { id: 'a', title: 'total aum' },
  { id: 'b', title: 'alex test' },
  { id: 'c', title: 'demo for lizzie', notSaved: true },
]

const strip = (props = {}) => {
  const handlers = { onHome: jest.fn(), onSelect: jest.fn(), onClose: jest.fn(), onNew: jest.fn() }
  const view = render(<ReportTabs tabs={TABS} shownId='b' {...handlers} {...props} />)
  const rerender = (more) => view.rerender(<ReportTabs tabs={TABS} shownId='b' {...handlers} {...props} {...more} />)
  return { ...handlers, rerender }
}

const tabOf = (name) => screen.getByRole('button', { name }).parentElement

// The unsaved report's tab, by its name. jsdom gives a span no display, so the name worked out here has a space
// before the comma that a browser's doesn't.
const NOT_SAVED = /^demo for lizzie ?, not saved$/

describe('ReportTabs', () => {
  it('marks the report shown, or home when none is', () => {
    strip()
    expect(screen.getByRole('button', { name: 'alex test' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'All reports' }).getAttribute('aria-current')).toBeNull()
    cleanup()

    strip({ shownId: null })
    expect(screen.getByRole('button', { name: 'All reports' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'alex test' }).getAttribute('aria-current')).toBeNull()
    cleanup()

    // Left out, it's the home page too.
    strip({ shownId: undefined })
    expect(screen.getByRole('button', { name: 'All reports' }).getAttribute('aria-current')).toBe('page')
  })

  it('goes home, shows a tab, or starts a new report', () => {
    const { onHome, onSelect, onNew } = strip()
    fireEvent.click(screen.getByRole('button', { name: 'All reports' }))
    fireEvent.click(screen.getByRole('button', { name: 'total aum' }))
    fireEvent.click(screen.getByRole('button', { name: 'New report' }))
    expect(onHome).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('a')
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('closes a tab with its × or a middle click, without showing it', () => {
    const { onClose, onSelect } = strip()
    fireEvent.click(screen.getByRole('button', { name: 'Close total aum' }))
    expect(onClose).toHaveBeenLastCalledWith('a')

    const tab = tabOf('alex test')
    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(onClose).toHaveBeenLastCalledWith('b')
    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps the middle button from starting the browser’s autoscroll', () => {
    strip()
    const tab = tabOf('alex test')
    expect(fireEvent.mouseDown(tab, { button: 1 })).toBe(false)
    expect(fireEvent.mouseDown(tab, { button: 0 })).toBe(true)
  })

  it('says a tab’s report is not saved, with a dot while another one is shown', () => {
    strip()
    const tab = tabOf(NOT_SAVED)
    expect(within(tab).getByTestId('reports-tab-not-saved')).toBeTruthy()
    cleanup()

    // Shown, it has its close button; the builder's toolbar says it isn't saved.
    strip({ shownId: 'c' })
    expect(screen.queryByTestId('reports-tab-not-saved')).toBeNull()
  })

  it('can hold off new reports until the list is in', () => {
    strip({ newDisabled: true })
    expect(screen.getByRole('button', { name: 'New report' }).disabled).toBe(true)
  })

  it('is a labelled navigation, with the full title as each tab’s tooltip', () => {
    strip()
    const nav = screen.getByRole('navigation', { name: 'Report tabs' })
    expect(nav.getAttribute('data-test')).toBe('reports-tabs')
    expect(screen.getByRole('button', { name: 'total aum' }).getAttribute('title')).toBe('total aum')
    expect(screen.getByRole('button', { name: 'Close total aum' }).getAttribute('title')).toBe('Close')
  })

  it('keeps the tab shown in view', () => {
    const scrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      const { rerender } = strip()
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView.mock.contexts[0]).toBe(tabOf('alex test'))
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })

      rerender({ shownId: 'c' })
      expect(scrollIntoView).toHaveBeenCalledTimes(2)
      expect(scrollIntoView.mock.contexts[1]).toBe(tabOf(NOT_SAVED))

      // A tab opened while another is shown: the one shown stays in view.
      rerender({ shownId: 'c', tabs: [...TABS, { id: 'd', title: 'q3 book' }] })
      expect(scrollIntoView).toHaveBeenCalledTimes(3)

      rerender({ shownId: null })
      expect(scrollIntoView).toHaveBeenCalledTimes(3)
    } finally {
      delete Element.prototype.scrollIntoView
    }
  })
})

describe('resizing a tab by its edge', () => {
  const rect = (left, right) => ({
    left,
    right,
    width: right - left,
    top: 0,
    bottom: 40,
    height: 40,
    x: left,
    y: 0,
    toJSON: () => ({}),
  })

  // jsdom lays nothing out, so the tab is given a size: 150px, its title starting 34px in with 35px after the
  // select button, and a 300px title — 370px with the whole title showing (a pixel spare).
  const sized = (name) => {
    const button = screen.getByRole('button', { name })
    const tab = button.parentElement
    const title = tab.querySelector('[data-tab-title]')
    jest.spyOn(tab, 'getBoundingClientRect').mockReturnValue(rect(0, 150))
    jest.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect(34, 118))
    jest.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(0, 115))
    Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 })
    return { tab, title, handle: within(tab).getByTestId('reports-tab-resize') }
  }

  // jsdom has no PointerEvent, and fireEvent.pointerDown would drop the button, the position and the pointer's id:
  // a mouse event of the pointer event's type carries them instead.
  const pointer = (type, { pointerId = 1, ...init } = {}) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
    Object.defineProperty(event, 'pointerId', { value: pointerId })
    return event
  }
  const pointerDown = (el, init) => fireEvent(el, pointer('pointerdown', init))
  const pointerMove = (el, init) => fireEvent(el, pointer('pointermove', init))
  const pointerUp = (el, init) => fireEvent(el, pointer('pointerup', init))
  const dragBy = (handle, from, to) => {
    pointerDown(handle, { button: 0, clientX: from, pointerId: 1 })
    pointerMove(handle, { clientX: to, pointerId: 1 })
    pointerUp(handle, { clientX: to, pointerId: 1 })
  }

  it('follows the edge while it’s dragged, and sets the width when let go', () => {
    const onResize = jest.fn()
    strip({ onResize })
    const { tab, handle } = sized('alex test')
    pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 })
    pointerMove(handle, { clientX: 160, pointerId: 1 })
    expect(tab.style.width).toBe('210px')
    expect(handle.hasAttribute('data-dragging')).toBe(true)
    expect(onResize).not.toHaveBeenCalled()
    pointerUp(handle, { clientX: 200, pointerId: 1 })
    expect(onResize).toHaveBeenCalledWith('b', 250)
    expect(handle.hasAttribute('data-dragging')).toBe(false)
  })

  it('goes no wider than the whole title, and no narrower than 96px', () => {
    const onResize = jest.fn()
    strip({ onResize })
    const { handle } = sized('alex test')
    dragBy(handle, 100, 900)
    expect(onResize).toHaveBeenLastCalledWith('b', 370)
    dragBy(handle, 100, -500)
    expect(onResize).toHaveBeenLastCalledWith('b', MIN_TAB_WIDTH)
    expect(MIN_TAB_WIDTH).toBe(96)
  })

  it('takes a click on the edge as a click, and a double-click as “fit the whole title”', () => {
    const onResize = jest.fn()
    strip({ onResize })
    const { handle } = sized('alex test')
    dragBy(handle, 100, 101)
    expect(onResize).not.toHaveBeenCalled()
    fireEvent.doubleClick(handle)
    expect(onResize).toHaveBeenCalledWith('b', 370)
  })

  it('takes the main button only, holds on to its pointer, and lets a cancelled drag go', () => {
    const onResize = jest.fn()
    strip({ onResize })
    const { tab, handle } = sized('alex test')
    handle.setPointerCapture = jest.fn()

    pointerDown(handle, { button: 2, clientX: 100, pointerId: 7 })
    pointerMove(handle, { clientX: 160, pointerId: 7 })
    expect(tab.style.width).toBe('')
    expect(handle.setPointerCapture).not.toHaveBeenCalled()

    // Pressed, it keeps the page from selecting text, and has the pointer's moves wherever it goes.
    expect(pointerDown(handle, { button: 0, clientX: 100, pointerId: 7 })).toBe(false)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(7)
    pointerMove(handle, { clientX: 160, pointerId: 8 })
    expect(tab.style.width).toBe('')
    pointerMove(handle, { clientX: 160, pointerId: 7 })
    expect(tab.style.width).toBe('210px')

    fireEvent(handle, pointer('pointercancel', { pointerId: 7 }))
    expect(tab.style.width).toBe('')
    pointerUp(handle, { clientX: 200, pointerId: 7 })
    expect(onResize).not.toHaveBeenCalled()
  })

  it('gives a tab the width it was given, with its title no longer cut at the usual length', () => {
    strip({ widths: { b: 280 }, onResize: jest.fn() })
    const tab = tabOf('alex test')
    expect(tab.style.width).toBe('280px')
    expect(tab.querySelector('[data-tab-title]').hasAttribute('data-capped')).toBe(false)
    const other = tabOf('total aum')
    expect(other.style.width).toBe('')
    expect(other.querySelector('[data-tab-title]').hasAttribute('data-capped')).toBe(true)
  })

  it('has no edge to drag when the page doesn’t keep widths', () => {
    strip()
    expect(screen.queryByTestId('reports-tab-resize')).toBeNull()
  })
})
