import React, { useCallback, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { dataFormattingType } from '../../props/types'

import { resolveRenderer, StatusItem } from './renderers'
import { getPhaseLabel } from './threadsReducer'

import './AgentMessage.scss'

const ITEM_RENDER_ERROR = "This part of the response couldn't be displayed."

/**
 * One boundary per item. Without it a single item that throws - an odd cell value in
 * a table, say - reaches the messenger-wide boundary, which swaps the whole screen
 * for an empty div until the page is reloaded. The fallback is a StatusItem, so it
 * still reports itself revealed and the items after it carry on mounting.
 */
class ItemErrorBoundary extends React.Component {
  static propTypes = {
    onRevealComplete: PropTypes.func,
    children: PropTypes.node,
  }

  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[AgentMessenger] response item failed to render', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <StatusItem type='error' data={{ text: ITEM_RENDER_ERROR }} onRevealComplete={this.props.onRevealComplete} />
      )
    }

    return this.props.children
  }
}

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
  showPhaseLabel,
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

  // Which message failed, so a retry re-sends the question that produced THIS
  // error rather than whatever was asked most recently.
  const onRetryMessage = useCallback(() => onRetry?.(message.id), [onRetry, message.id])

  const spacingClass = isFirst ? ' is-first' : followsSameRole ? ' follows-same-role' : ''
  const phaseLabel = showPhaseLabel ? getPhaseLabel(message.phase) : null

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
        {/* Which step of the agent's workflow this answer came from. It's the
            difference between "it's asking me questions" and "it's stalling", and
            between a partial data pull and the final word on the question. */}
        {!!phaseLabel && (
          <div className={`react-autoql-agent-phase-label is-${message.phase}`}>
            <span className='react-autoql-agent-phase-dot' aria-hidden='true' />
            <span>{phaseLabel}</span>
          </div>
        )}
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
              <ItemErrorBoundary onRevealComplete={() => onRevealComplete(item.id)}>
                <Renderer
                  data={item.data}
                  type={item.type}
                  isRevealed={isRevealed}
                  shouldAnimate={enableTypewriter}
                  dataFormatting={dataFormatting}
                  maxHeight={tableMaxHeight}
                  onProgress={onItemProgress}
                  onRetry={onRetry ? onRetryMessage : undefined}
                  onStartNewSession={onStartNewSession}
                  onRevealComplete={() => onRevealComplete(item.id)}
                />
              </ItemErrorBoundary>
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
    phase: PropTypes.string,
  }).isRequired,
  isFirst: PropTypes.bool,
  followsSameRole: PropTypes.bool,
  dataFormatting: dataFormattingType,
  tableMaxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  enableTypewriter: PropTypes.bool,
  showPhaseLabel: PropTypes.bool,
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
  showPhaseLabel: true,
  showModelLabel: false,
  modelLabel: undefined,
  revealedItemIds: {},
  onItemRevealed: undefined,
  onItemProgress: undefined,
  onRetry: undefined,
  onStartNewSession: undefined,
}

export default React.memo(AgentMessage)
