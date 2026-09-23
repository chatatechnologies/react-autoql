import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

// The reveal runs for a fixed duration rather than a fixed characters-per-frame rate,
// so a long answer doesn't crawl and a dropped frame changes nothing about the pace.
const CHARS_PER_SECOND = 1400
const MIN_DURATION_MS = 700
const MAX_DURATION_MS = 3200
// Repainting text faster than this buys nothing visually and costs a markdown parse
// per tick, so the reveal updates at ~30fps even though it is driven by rAF.
const MIN_TICK_MS = 32

const prefersReducedMotion = () => {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch (error) {
    return false
  }
}

/**
 * A finished block of markdown. Memoized on its content so ReactMarkdown parses each
 * block exactly once: without this the whole answer is re-parsed on every reveal
 * tick, which is what made long responses stutter.
 */
const MarkdownBlock = React.memo(({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
))

MarkdownBlock.displayName = 'MarkdownBlock'
MarkdownBlock.propTypes = { content: PropTypes.string }

/**
 * Markdown text item. Configured to match SummaryContent's ReactMarkdown setup so
 * agent text renders the same way analysis summaries already do elsewhere.
 *
 * Reveal is block-by-block: everything above the cursor is already-parsed static
 * markdown, and only the block being typed re-renders.
 */
const TextItem = ({ data, isRevealed, shouldAnimate, onRevealComplete, onProgress }) => {
  // The API sometimes returns escaped newlines rather than real ones.
  const text = useMemo(() => {
    const raw = typeof data?.text === 'string' ? data.text : `${data?.text ?? ''}`
    return raw.replace(/\\n/g, '\n')
  }, [data])

  // Paragraphs, lists and headings are separated by blank lines; splitting there
  // keeps every markdown construct intact inside a single block.
  const blocks = useMemo(() => {
    const parts = text.split(/(\n{2,})/)
    const out = []
    let offset = 0

    for (let i = 0; i < parts.length; i += 2) {
      const content = parts[i]
      const separator = parts[i + 1] ?? ''

      if (content) {
        out.push({ content, start: offset, end: offset + content.length })
      }

      offset += content.length + separator.length
    }

    return out
  }, [text])

  const animate = shouldAnimate && !isRevealed && !prefersReducedMotion() && !!text
  const [revealedLength, setRevealedLength] = useState(animate ? 0 : text.length)
  const frameRef = useRef(null)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!animate) {
      setRevealedLength(text.length)

      if (!completedRef.current) {
        completedRef.current = true
        onRevealComplete?.()
      }

      return undefined
    }

    const total = text.length
    const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, (total / CHARS_PER_SECOND) * 1000))
    const startTime = performance.now()
    let lastTick = 0

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)

      if (progress >= 1) {
        frameRef.current = null
        setRevealedLength(total)
        onProgress?.()
        completedRef.current = true
        onRevealComplete?.()
        return
      }

      if (now - lastTick >= MIN_TICK_MS) {
        lastTick = now
        // Ease out slightly: the answer arrives quickly and settles, rather than
        // stopping dead at a constant rate.
        const eased = 1 - Math.pow(1 - progress, 1.4)
        setRevealedLength(Math.ceil(eased * total))
        onProgress?.()
      }

      frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
    // onRevealComplete/onProgress are stable callbacks from the message component.
  }, [animate, text])

  const isTyping = revealedLength < text.length

  // The split is a reveal mechanism, not a rendering one. Blank lines separate
  // paragraphs, but they also appear *inside* constructs - a fenced code block, a
  // list item's continuation paragraph, a reference-style link and its definition
  // - and parsing those in separate documents comes apart permanently. So the
  // finished text is one ReactMarkdown, the way SummaryContent renders its string.
  if (!isTyping) {
    return (
      <div className='react-autoql-agent-text-item'>
        <MarkdownBlock content={text} />
      </div>
    )
  }

  return (
    <div className='react-autoql-agent-text-item is-typing'>
      {blocks.map((block) => {
        if (revealedLength >= block.end) {
          return <MarkdownBlock key={block.start} content={block.content} />
        }

        if (revealedLength <= block.start) {
          return null
        }

        // The one block straddling the cursor - the only markdown re-parsed per tick.
        // Rendered without a wrapper so the paragraph stays the container's last
        // child, which is what the caret in renderers.scss attaches to.
        return (
          <React.Fragment key={block.start}>
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {block.content.slice(0, revealedLength - block.start)}
            </ReactMarkdown>
          </React.Fragment>
        )
      })}
    </div>
  )
}

TextItem.propTypes = {
  data: PropTypes.shape({ text: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) }),
  isRevealed: PropTypes.bool,
  shouldAnimate: PropTypes.bool,
  onRevealComplete: PropTypes.func,
  onProgress: PropTypes.func,
}

TextItem.defaultProps = {
  data: {},
  isRevealed: false,
  shouldAnimate: true,
  onRevealComplete: undefined,
  onProgress: undefined,
}

export default TextItem
