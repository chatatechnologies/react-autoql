import React from 'react'

// The hint pops up once per page load, and the store remembers which copy got it
// for the life of the module. So every test here starts a fresh "page": a fresh copy
// of the component and its store, rendered with a fresh ReactDOM from the same
// registry (React Testing Library can't be reloaded mid-test).
const loadPage = () => {
  let page
  jest.isolateModules(() => {
    page = {
      ReactDOM: require('react-dom'),
      act: require('react-dom/test-utils').act,
      InterpretationHint: require('./Onboarding').InterpretationHint,
    }
  })

  const mounted = []
  page.mount = () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    page.act(() => {
      page.ReactDOM.render(<page.InterpretationHint />, container)
    })
    mounted.push(container)
    return container
  }
  page.unmount = (container) => {
    page.act(() => {
      page.ReactDOM.unmountComponentAtNode(container)
    })
    container.remove()
  }
  page.unmountAll = () => mounted.forEach((container) => container.isConnected && page.unmount(container))
  return page
}

const getHint = (container) => container.querySelector('.react-autoql-onboarding-hint')
const isFadedIn = (container) => getHint(container).classList.contains('react-autoql-onboarding-hint-visible')

let page
beforeEach(() => localStorage.clear())
afterEach(() => page?.unmountAll())

describe('InterpretationHint', () => {
  test('pops up once per page: not on a later answer, even after the first one goes', () => {
    page = loadPage()
    const firstAnswer = page.mount()
    expect(getHint(firstAnswer)).not.toBeNull()

    // A newer answer, in the same thread or another tab
    const newerAnswer = page.mount()
    expect(getHint(newerAnswer)).toBeNull()

    page.unmount(firstAnswer)
    expect(getHint(page.mount())).toBeNull()
  })

  test('pops up again after a reload until it is dismissed', () => {
    page = loadPage()
    page.mount()
    page.unmountAll()

    page = loadPage()
    const afterReload = page.mount()
    expect(getHint(afterReload)).not.toBeNull()

    page.act(() => {
      afterReload.querySelector('[aria-label="Dismiss"]').click()
    })
    expect(getHint(afterReload)).toBeNull()
    expect(localStorage.getItem('react-autoql-onboarding-dismissed:interpretation-hint')).toBe('true')
    page.unmountAll()

    page = loadPage()
    expect(getHint(page.mount())).toBeNull()
  })

  test('is not affected by dismissing the What’s new card', () => {
    localStorage.setItem('react-autoql-onboarding-dismissed:whats-new-follow-ups', 'true')
    page = loadPage()
    expect(getHint(page.mount())).not.toBeNull()
  })
})

describe('InterpretationHint timing', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    delete window.ResizeObserver
  })

  test('stays hidden while the answer lays out, then fades in', () => {
    page = loadPage()
    const answer = page.mount()
    expect(isFadedIn(answer)).toBe(false)

    page.act(() => jest.advanceTimersByTime(500))
    expect(isFadedIn(answer)).toBe(false)

    page.act(() => jest.advanceTimersByTime(200))
    expect(isFadedIn(answer)).toBe(true)
  })

  test('waits for the answer to stop resizing, up to a limit', () => {
    let notifyResize
    window.ResizeObserver = class {
      constructor(callback) {
        notifyResize = callback
      }
      observe() {}
      disconnect() {}
    }

    page = loadPage()
    const answer = page.mount()
    // The answer keeps growing every 200ms, so it never goes quiet.
    for (let elapsed = 0; elapsed < 2800; elapsed += 200) {
      page.act(() => {
        jest.advanceTimersByTime(200)
        notifyResize()
      })
    }
    expect(isFadedIn(answer)).toBe(false)

    page.act(() => jest.advanceTimersByTime(200))
    expect(isFadedIn(answer)).toBe(true)
  })
})
