import React, { useEffect, useRef, useState } from 'react'

import { Icon } from '../Icon'
import { ONBOARDING_KEYS, useOnboarding } from '../../js/onboarding'

import './Onboarding.scss'

export const FOLLOW_UPS_DOCS_URL = 'https://chata.readme.io/docs/follow-ups'

const WHATS_NEW_ITEMS = [
  { title: 'Follow-ups', description: 'build on your previous questions.' },
  { title: 'New topic?', description: 'Start a new thread.' },
]

// A "New" banner above the Data Messenger's input, until the user closes it.
export const WhatsNew = () => {
  const [isVisible, dismiss] = useOnboarding(ONBOARDING_KEYS.WHATS_NEW)

  if (!isVisible) {
    return null
  }

  return (
    <div className='react-autoql-onboarding-banner' role='note' data-test='react-autoql-onboarding-whats-new'>
      <span className='react-autoql-onboarding-new-badge'>New</span>
      <ul className='react-autoql-onboarding-list'>
        {WHATS_NEW_ITEMS.map((item, i) => (
          <li key={i}>
            <strong>{item.title}</strong> {item.description}
          </li>
        ))}
      </ul>
      <a className='react-autoql-onboarding-link' href={FOLLOW_UPS_DOCS_URL} target='_blank' rel='noopener noreferrer'>
        Learn more →
      </a>
      <button type='button' className='react-autoql-onboarding-close' onClick={dismiss} aria-label='Dismiss'>
        <Icon type='close' />
      </button>
    </div>
  )
}

// The answer above the hint keeps changing size while it lays out (a table fills in,
// a chart draws), which would push the hint around. It fades in once the answer has
// gone this long without resizing...
const HINT_SETTLE_MS = 300
// ...but never before the answer's own entrance animation has finished...
const HINT_MIN_DELAY_MS = 600
// ...and never later than this, for an answer that keeps resizing.
const HINT_MAX_DELAY_MS = 3000

// A coach mark above a response's "Interpreted as", pointing down at it, until the
// user closes it. It pops up once per page load, on the first answer it's offered
// to: ChatContent offers it to each thread's latest answer, and once that moves on
// (a newer answer, another tab) it doesn't pop up again until the page is reloaded.
export const InterpretationHint = () => {
  const [isVisible, dismiss] = useOnboarding(ONBOARDING_KEYS.INTERPRETATION_HINT, { oncePerPage: true })
  const [isSettled, setIsSettled] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!isVisible || isSettled) {
      return
    }

    const mountedAt = Date.now()
    let settleTimer
    let observer

    const show = () => {
      observer?.disconnect()
      setIsSettled(true)
    }

    const waitForQuiet = () => {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(show, Math.max(HINT_SETTLE_MS, HINT_MIN_DELAY_MS - (Date.now() - mountedAt)))
    }

    const maxTimer = setTimeout(show, HINT_MAX_DELAY_MS)

    const message = ref.current?.closest('.chat-message-and-rt-container') ?? ref.current?.parentElement
    if (message && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(waitForQuiet)
      observer.observe(message)
    }

    waitForQuiet()

    return () => {
      clearTimeout(settleTimer)
      clearTimeout(maxTimer)
      observer?.disconnect()
    }
  }, [isVisible, isSettled])

  if (!isVisible) {
    return null
  }

  return (
    <div
      ref={ref}
      className={`react-autoql-onboarding-hint${isSettled ? ' react-autoql-onboarding-hint-visible' : ''}`}
      role='note'
      aria-hidden={!isSettled}
      data-test='react-autoql-onboarding-interpretation-hint'
    >
      <span className='react-autoql-onboarding-hint-text'>
        <strong>Check the interpretation.</strong> Not what you meant? Say so in the chat, e.g. “no, X not Y”.
      </span>
      <button type='button' className='react-autoql-onboarding-close' onClick={dismiss} aria-label='Dismiss'>
        <Icon type='close' />
      </button>
    </div>
  )
}
