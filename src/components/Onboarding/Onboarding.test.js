import React from 'react'
import { render, fireEvent } from '@testing-library/react'

import { WhatsNew, FOLLOW_UPS_DOCS_URL } from './Onboarding'

// A dismissal is also held in a module-level set for the life of the page, so the
// component tests below run in order: the card is shown before it is dismissed.
// Reload behaviour is covered on a fresh copy of the store module instead. The
// interpretation hint has its own file, InterpretationHint.test.js.
const loadFreshStore = () => {
  let store
  jest.isolateModules(() => {
    store = require('../../js/onboarding')
  })
  return store
}

describe('onboarding store', () => {
  beforeEach(() => localStorage.clear())

  test('a dismissal survives a page reload', () => {
    loadFreshStore().dismissOnboarding('interpretation-hint')

    const reloaded = loadFreshStore()
    expect(reloaded.isOnboardingDismissed('interpretation-hint')).toBe(true)
    expect(reloaded.isOnboardingDismissed('whats-new-follow-ups')).toBe(false)
  })

  test('reads localStorage once per prompt, however often it is asked', () => {
    const store = loadFreshStore()
    const getItem = jest.spyOn(Storage.prototype, 'getItem')

    for (let i = 0; i < 5; i++) {
      store.isOnboardingDismissed('interpretation-hint')
    }
    expect(getItem).toHaveBeenCalledTimes(1)

    getItem.mockRestore()
  })

  test('still dismisses for the session when localStorage throws', () => {
    const store = loadFreshStore()
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    store.dismissOnboarding('interpretation-hint')
    expect(store.isOnboardingDismissed('interpretation-hint')).toBe(true)

    setItem.mockRestore()
  })
})

describe('WhatsNew', () => {
  beforeAll(() => localStorage.clear())

  test('shows the New banner, linking to the follow-ups docs', () => {
    const { getByText } = render(<WhatsNew />)
    expect(getByText('New')).toBeTruthy()
    expect(getByText('Follow-ups')).toBeTruthy()
    expect(getByText('New topic?')).toBeTruthy()
    expect(getByText('Learn more →').getAttribute('href')).toBe('https://chata.readme.io/docs/follow-ups')
    expect(FOLLOW_UPS_DOCS_URL).toBe('https://chata.readme.io/docs/follow-ups')
  })

  test('stays closed once dismissed, and remembers it in localStorage', () => {
    const first = render(<WhatsNew />)
    fireEvent.click(first.getByLabelText('Dismiss'))
    expect(first.queryByText('Follow-ups')).toBeNull()
    first.unmount()

    expect(render(<WhatsNew />).queryByText('Follow-ups')).toBeNull()
    expect(localStorage.getItem('react-autoql-onboarding-dismissed:whats-new-follow-ups')).toBe('true')
  })
})
