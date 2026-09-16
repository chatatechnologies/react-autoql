import React, { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { dataFormattingType } from '../../props/types'

import { resolveRenderer } from './renderers'

import './AgentMessage.scss'

/**
 * One message - a user bubble, or an agent block that walks its response items in
 * order. Items reveal one at a time: item n+1 mounts only once item n reports done,
 * which is what makes a table-then-text response land in the right sequence.
 *
 * The agent block hangs its items off a vertical rule beside the avatar; that rule
 * is what groups several items into one answer instead of a flat stack of cards.
 */
const AgentMessage = ({
  message,
  isFirst,
  followsSameRole,
  dataFormatting,
  tableMaxHeight,
  enableTypewriter,
  showModelLabel,
  modelLabel,
  revealedItemIds,
  onItemRevealed,
  onItemProgress,
  onRetry,
  onStartNewSession,
}) => {
  const isUser = message.role === 'user'

  // Items already revealed in a previous render (or on a previous thread visit) must
  // not replay their animation, so anything already marked stays fully shown.
  const initiallyRevealedCount = useMemo(() => {
    let count = 0
    while (count < message.items.length && revealedItemIds[message.items[count].id]) {
      count += 1
    }
    return count
  }, [message.items, revealedItemIds])

  const [revealedCount, setRevealedCount] = useState(initiallyRevealedCount)
  const visibleCount = Math.max(revealedCount, initiallyRevealedCount)

  const onRevealComplete = useCallback(
    (itemId) => {
      onItemRevealed?.(itemId)
      setRevealedCount((current) => current + 1)
    },
    [onItemRevealed],
  )

  const spacingClass = isFirst ? ' is-first' : followsSameRole ? ' follows-same-role' : ''

  if (isUser) {
    const text = message.items?.[0]?.data?.text ?? ''

    return (
      <div className={`react-autoql-agent-message is-user${spacingClass}`} id={`agent-message-${message.id}`}>
        <div className='react-autoql-agent-user-bubble'>{text}</div>
      </div>
    )
  }

  return (
    <div className={`react-autoql-agent-message is-agent${spacingClass}`} id={`agent-message-${message.id}`}>
      <div className='react-autoql-agent-avatar'>
        <Icon type='react-autoql-logo' />
      </div>
      <div className='react-autoql-agent-message-body'>
        {showModelLabel && !!modelLabel && <div className='react-autoql-agent-model-label'>{modelLabel}</div>}
        {message.items.map((item, index) => {
          // Only render up to the first unrevealed item so reveals stay sequential.
          if (index > visibleCount) {
            return null
          }

          const Renderer = resolveRenderer(item.type)
          const isRevealed = !!revealedItemIds[item.id]

          return (
            <div className='react-autoql-agent-item' key={item.id}>
              <Renderer
                data={item.data}
                type={item.type}
                isRevealed={isRevealed}
                shouldAnimate={enableTypewriter}
                dataFormatting={dataFormatting}
                maxHeight={tableMaxHeight}
                onProgress={onItemProgress}
                onRetry={onRetry}
                onStartNewSession={onStartNewSession}
                onRevealComplete={() => onRevealComplete(item.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

AgentMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.oneOf(['user', 'agent']),
    items: PropTypes.array,
  }).isRequired,
  isFirst: PropTypes.bool,
  followsSameRole: PropTypes.bool,
  dataFormatting: dataFormattingType,
  tableMaxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  enableTypewriter: PropTypes.bool,
  showModelLabel: PropTypes.bool,
  modelLabel: PropTypes.string,
  revealedItemIds: PropTypes.shape({}),
  onItemRevealed: PropTypes.func,
  onItemProgress: PropTypes.func,
  onRetry: PropTypes.func,
  onStartNewSession: PropTypes.func,
}

AgentMessage.defaultProps = {
  isFirst: false,
  followsSameRole: false,
  dataFormatting: dataFormattingDefault,
  tableMaxHeight: 400,
  enableTypewriter: true,
  showModelLabel: false,
  modelLabel: undefined,
  revealedItemIds: {},
  onItemRevealed: undefined,
  onItemProgress: undefined,
  onRetry: undefined,
  onStartNewSession: undefined,
}

export default React.memo(AgentMessage)
