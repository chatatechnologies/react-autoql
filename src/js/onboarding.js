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

// What localStorage held for each key, read once: every copy of a prompt asks on
// every render.
const storedDismissals = new Map()

// For prompts that pop up only once per page: the owner that got to show it (see
// useOnboarding's ownerId). Never released, so a later owner (a newer answer,
// another tab) doesn't pop it up again.
const owners = new Map()
let nextCopyId = 0

const notify = (key) => listeners.forEach((listener) => listener(key))

export const isOnboardingDismissed = (key) => {
  if (dismissedInMemory.has(key)) {
    return true
  }

  if (!storedDismissals.has(key)) {
    let stored = false
    try {
      stored = localStorage.getItem(getStorageKey(key)) === 'true'
    } catch {
      // Storage can be unavailable in privacy modes and non-browser environments.
    }
    storedDismissals.set(key, stored)
  }

  return storedDismissals.get(key)
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
 *   owner to claim it shows it, and no other does until the page is reloaded, even
 *   if the first goes away. A dismissal still hides it for good.
 * @param {string} [options.ownerId] who a oncePerPage prompt belongs to, so a copy
 *   that unmounts and comes back (its tab hidden and shown again) is still the
 *   owner. Defaults to this copy alone.
 * @returns {[boolean, function]}
 */
export const useOnboarding = (key, { oncePerPage = false, ownerId } = {}) => {
  const [copyId] = useState(() => `copy-${nextCopyId++}`)
  const owner = ownerId ?? copyId
  const [, rerender] = useReducer((count) => count + 1, 0)

  useEffect(() => {
    const listener = (changedKey) => {
      if (changedKey === key) {
        rerender()
      }
    }
    listeners.add(listener)

    if (oncePerPage && !owners.has(key)) {
      owners.set(key, owner)
      rerender()
    }

    return () => listeners.delete(listener)
  }, [key, oncePerPage, owner])

  const dismiss = useCallback(() => dismissOnboarding(key), [key])

  const isShown = !isOnboardingDismissed(key) && (!oncePerPage || owners.get(key) === owner)

  return [isShown, dismiss]
}
