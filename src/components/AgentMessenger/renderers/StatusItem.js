import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const UNSUPPORTED_MESSAGE = "This response type isn't supported in the messenger yet."
const DEFAULT_ERROR_TITLE = 'Request failed'

/**
 * Covers error items, status/info items, and the unknown-type fallback. Having one
 * component for all three guarantees an unrecognized response item never renders a
 * blank message.
 */
const StatusItem = ({ data, type, onRetry, onRevealComplete, onProgress }) => {
  const completedRef = useRef(false)

  useEffect(() => {
    if (completedRef.current) {
      return
    }

    completedRef.current = true
    onProgress?.()
    onRevealComplete?.()
  }, [])

  const isError = type === 'error'
  const text = data?.text ?? data?.message ?? (isError ? 'Something went wrong.' : UNSUPPORTED_MESSAGE)

  if (isError) {
    return (
      <div className='react-autoql-agent-status-item is-error'>
        <div className='react-autoql-agent-status-title'>{data?.title ?? DEFAULT_ERROR_TITLE}</div>
        <div className='react-autoql-agent-status-text'>
          {text}{' '}
          {!!onRetry && (
            <button className='react-autoql-agent-status-retry' onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className='react-autoql-agent-status-item is-info'>
      <span className='react-autoql-agent-status-text'>{text}</span>
    </div>
  )
}

StatusItem.propTypes = {
  data: PropTypes.shape({ title: PropTypes.string, text: PropTypes.string, message: PropTypes.string }),
  type: PropTypes.string,
  onRetry: PropTypes.func,
  onRevealComplete: PropTypes.func,
  onProgress: PropTypes.func,
}

StatusItem.defaultProps = {
  data: {},
  type: 'status',
  onRetry: undefined,
  onRevealComplete: undefined,
  onProgress: undefined,
}

export default StatusItem
