import { deepEqual } from 'autoql-fe-utils'

/**
 * `deepEqual(this.props, nextProps)` for components that are handed a query
 * response, with the response itself compared by identity.
 *
 * The plain version is `lodash.isEqual` over the whole props object, and it is the
 * reason switching session tabs stalls. Two things make it worse than it looks:
 *
 *   - the props include the full response, so every comparison walks every row;
 *   - `lodash.isEqual` compares functions by reference, and these components are
 *     given inline arrow props that are rebuilt every render — so that first walk
 *     *always* fails, and the fallback then walks every key again and calls
 *     `toString()` on every function prop.
 *
 * Switching tabs re-renders both the outgoing and the incoming transcript, so all of
 * that runs for every message on screen, twice over.
 *
 * Here, the keys named in `identityKeys` are compared with `===`. That is sound for
 * the props they name: a response, its rows and its columns are stable objects held
 * in state or in an instance variable, replaced wholesale rather than edited, so a
 * new identity really does mean new data. It is also the safe direction to be wrong
 * in — a response rebuilt into an equal object renders once more than it strictly
 * needs to, rather than showing stale data.
 *
 * Everything else keeps the old semantics, functions-by-toString included, so props
 * that are rebuilt every render still don't force a render.
 */
export const arePropsEqualByIdentity = (a, b, identityKeys) => {
  if (a === b) {
    return true
  }

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  const aKeys = Object.keys(a)

  if (aKeys.length !== Object.keys(b).length) {
    return false
  }

  return aKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false
    }

    const valueA = a[key]
    const valueB = b[key]

    // The common case by a wide margin: most props are the same reference render to
    // render, and answering them here is what keeps this cheap.
    if (valueA === valueB) {
      return true
    }

    if (identityKeys.has(key)) {
      return false
    }

    // Inline arrows are rebuilt every render, so comparing them by reference would
    // make every update look like a change. This mirrors what deepEqual does.
    if (typeof valueA === 'function' && typeof valueB === 'function') {
      return String(valueA) === String(valueB)
    }

    return deepEqual(valueA, valueB)
  })
}

/**
 * Same keys, same values by reference.
 *
 * Exists for `shouldComponentUpdate` on components that hold query responses. The
 * usual `deepEqual(this.props, nextProps)` walks every row of every response it is
 * handed, which is the expensive part of an update that was going to be skipped
 * anyway — so a component that only needs to know "did anything change at all"
 * asks this instead, and pays one pass over the top-level keys.
 *
 * Deliberately not a deep compare: callers use it where a new object identity is
 * itself the signal (React state after `setState`, a rebuilt props object), not
 * where two structurally identical objects have to be recognised as equal.
 */
export const isShallowEqual = (a, b) => {
  if (a === b) {
    return true
  }

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) {
    return false
  }

  return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key])
}
