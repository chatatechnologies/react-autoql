import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import PropTypes from 'prop-types'
import { REQUEST_CANCELLED_ERROR } from 'autoql-fe-utils'
import { Icon } from '../Icon'
import { Spinner } from '../Spinner'
import { resolveValueLabelLock } from '../../js/valueLabelHelpers'

import './ValueLabelQueryPopover.scss'

// Asks a new question about one table cell's value. The value is resolved to a value label
// as soon as this opens, and the lock it resolves to is shown, so the user can see what the
// new query will be filtered on before running it.
export default function ValueLabelQueryPopoverContent({ authentication, column, value, formattedValue, onSubmit }) {
  const [queryText, setQueryText] = useState('')
  const [lock, setLock] = useState(undefined)
  const [error, setError] = useState(undefined)
  const inputRef = useRef(null)

  // Not autoFocus: the popover attaches its container to the page only after this mounts, and
  // focusing an input that isn't on the page does nothing. preventScroll, because the popover
  // may not be in place yet.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const source = axios.CancelToken?.source()
    let isCurrent = true

    setLock(undefined)
    setError(undefined)

    resolveValueLabelLock({ authentication, value, column, cancelToken: source?.token })
      .then((newLock) => isCurrent && setLock(newLock))
      .catch((e) => {
        if (!isCurrent || e?.data?.message === REQUEST_CANCELLED_ERROR) {
          return
        }
        setError(e?.code ? e.message : `Couldn't look up "${formattedValue ?? value}"`)
      })

    return () => {
      isCurrent = false
      source?.cancel(REQUEST_CANCELLED_ERROR)
    }
  }, [value, column?.name])

  const canSubmit = !!lock && !!queryText.trim()

  const submit = () => {
    if (canSubmit) {
      onSubmit({ query: queryText.trim(), lock })
    }
  }

  const renderLock = () => {
    if (error) {
      return <div className='value-label-query-popover-error'>{error}</div>
    }

    if (!lock) {
      return (
        <div className='value-label-query-popover-lock value-label-query-popover-lock-loading'>
          <Spinner /> Looking up value...
        </div>
      )
    }

    return (
      <div className='value-label-query-popover-lock'>
        Filtered on <strong>{lock.format_txt ?? lock.value}</strong>
        {lock.show_message ? <span className='value-label-query-popover-category'> ({lock.show_message})</span> : null}
      </div>
    )
  }

  return (
    <div className='value-label-query-popover-content'>
      <label className='value-label-query-popover-label'>Ask about &ldquo;{formattedValue ?? value}&rdquo;</label>
      {renderLock()}
      <div className='value-label-query-popover-input-wrapper'>
        <input
          className='value-label-query-popover-input'
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          ref={inputRef}
          placeholder='Type a question...'
        />
        {/* Inside the input at the right end, the same send button as the query input */}
        <button
          className='react-autoql-input-send-button value-label-query-popover-send-button'
          onClick={submit}
          disabled={!canSubmit}
          type='button'
          aria-label='Send query'
        >
          <Icon type='send' />
        </button>
      </div>
    </div>
  )
}

ValueLabelQueryPopoverContent.propTypes = {
  authentication: PropTypes.shape({}),
  column: PropTypes.shape({ name: PropTypes.string }).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  formattedValue: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
}

ValueLabelQueryPopoverContent.defaultProps = {
  authentication: {},
  formattedValue: undefined,
}
