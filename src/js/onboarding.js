import { useCallback, useEffect, useReducer, useState } from 'react'

// One-time onboarding prompts (coach marks, "New" cards). Once the user closes one
// it stays closed in this browser, so it is remembered in localStorage rather than
// in component state.
export const ONBOARDING_KEYS = {
  INTERPRETATION_HINT: 'interpretation-hint',
  WHATS_NEW: 'whats-new-follow-ups',
}

const STORAGE_PREFIX = 'react-autoql-onboarding-dismissed'

const getStorageKey = (key) => `${STORAGE_PREFIX}:${key}`

// Also kept in memory: where storage is unavailable (privacy modes) a dismissal
// still has to hold for the rest of the page's life.
const dismissedInMemory = new Set()
const listeners = new Set()

// For prompts that pop up only once per page: the copy that got to show it. Never
// released, so a later copy (a newer answer, another tab) doesn't pop it up again.
const owners = new Map()
let nextCopyId = 0

const notify = (key) => listeners.forEach((listener) => listener(key))

export const isOnboardingDismissed = (key) => {
  if (dismissedInMemory.has(key)) {
    return true
  }

  try {
    return localStorage.getItem(getStorageKey(key)) === 'true'
  } catch {
    return false
  }
}

export const dismissOnboarding = (key) => {
  dismissedInMemory.add(key)

  try {
    localStorage.setItem(getStorageKey(key), 'true')
  } catch {
    // Storage can be unavailable in privacy modes and non-browser environments.
  }

  // Every session tab mounts its own thread, so a prompt closed in one has to
  // disappear from the others that are showing it too.
  notify(key)
}

/**
 * Whether a one-time onboarding prompt should still be shown, and a function that
 * dismisses it for good.
 *
 * @param {string} key a value of ONBOARDING_KEYS
 * @param {object} [options]
 * @param {boolean} [options.oncePerPage] pop up only once per page load: the first
 *   copy to mount shows it, and no other copy does until the page is reloaded, even
 *   if that first copy goes away. A dismissal still hides it for good.
 * @returns {[boolean, function]}
 */
export const useOnboarding = (key, { oncePerPage = false } = {}) => {
  const [copyId] = useState(() => nextCopyId++)
  const [, rerender] = useReducer((count) => count + 1, 0)

  useEffect(() => {
    const listener = (changedKey) => {
      if (changedKey === key) {
        rerender()
      }
    }
    listeners.add(listener)

    if (oncePerPage && !owners.has(key)) {
      owners.set(key, copyId)
      rerender()
    }

    return () => listeners.delete(listener)
  }, [key, oncePerPage, copyId])

  const dismiss = useCallback(() => dismissOnboarding(key), [key])

  const isShown = !isOnboardingDismissed(key) && (!oncePerPage || owners.get(key) === copyId)

  return [isShown, dismiss]
}
