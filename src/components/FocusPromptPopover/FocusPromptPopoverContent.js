import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { Input } from '../Input'

const DEFAULT_NOT_WANDABLE_MESSAGE =
  "This result can't be analyzed with AI for this dataset. Try a different query or focus topic."

/** Quote API may return many fractional digits (e.g. 0.0583518); always show USD with exactly 2 decimals. */
function formatQuoteCostUsd(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return '0.00'
  }
  return n.toFixed(2)
}

export default function FocusPromptPopoverContent({
  focusPrompt,
  onFocusPromptChange,
  onGetQuote,
  onAnalyze,
  quoteResult,
  isFetchingQuote,
  focusError,
  isAnalyzeDisabled,
  isAnalyzeLoading,
  onKeyDown,
  inputDisabled,
  contentClassName,
  notWandableMessage,
  showQuoteButton,
}) {
  return (
    <div className={contentClassName || 'focus-prompt-popover-content'}>
      <div className='focus-prompt-popover-header'>
        <label className='focus-prompt-popover-label'>Focus on a specific topic (optional)</label>
        <div className='focus-prompt-popover-description'>
          Enter a topic to generate a summary tailored to that focus area
        </div>
      </div>
      <div className='focus-prompt-popover-input-wrapper'>
        <Input
          value={focusPrompt}
          onChange={onFocusPromptChange}
          onKeyDown={onKeyDown}
          placeholder='e.g., "Anomaly Detection"'
          // maxLength={100}
          disabled={inputDisabled}
          style={{ width: '100%' }}
        />
      </div>
      {quoteResult &&
        (quoteResult.wandable ? (
          <div className='focus-prompt-popover-estimated-cost'>
            <div className='focus-prompt-popover-estimated-cost-left'>
              <span className='focus-prompt-popover-estimated-cost-label'>Estimated cost</span>
            </div>
            <div className='focus-prompt-popover-estimated-cost-price'>${formatQuoteCostUsd(quoteResult.cost)}</div>
          </div>
        ) : (
          <div className='focus-prompt-popover-not-wandable' role='status'>
            {notWandableMessage}
          </div>
        ))}
      {focusError && <div className='focus-prompt-popover-error'>{focusError}</div>}
      <div className='focus-prompt-popover-actions'>
        {showQuoteButton && (
          <Button
            type='default'
            size='medium'
            icon='sparkles'
            onClick={onGetQuote}
            loading={isFetchingQuote}
            border={true}
          >
            Get quote
          </Button>
        )}
        <Button
          type='primary'
          size='medium'
          icon='magic-wand'
          onClick={onAnalyze}
          disabled={isAnalyzeDisabled || (quoteResult && !quoteResult.wandable)}
          loading={isAnalyzeLoading}
        >
          Auto Analyze
        </Button>
      </div>
    </div>
  )
}

FocusPromptPopoverContent.propTypes = {
  focusPrompt: PropTypes.string,
  onFocusPromptChange: PropTypes.func.isRequired,
  onGetQuote: PropTypes.func.isRequired,
  onAnalyze: PropTypes.func.isRequired,
  quoteResult: PropTypes.shape({
    wandable: PropTypes.bool,
    cost: PropTypes.number,
  }),
  isFetchingQuote: PropTypes.bool,
  focusError: PropTypes.string,
  isAnalyzeDisabled: PropTypes.bool,
  isAnalyzeLoading: PropTypes.bool,
  onKeyDown: PropTypes.func,
  inputDisabled: PropTypes.bool,
  contentClassName: PropTypes.string,
  notWandableMessage: PropTypes.string,
  showQuoteButton: PropTypes.bool,
}

FocusPromptPopoverContent.defaultProps = {
  focusPrompt: '',
  quoteResult: null,
  isFetchingQuote: false,
  focusError: null,
  isAnalyzeDisabled: false,
  isAnalyzeLoading: false,
  onKeyDown: undefined,
  inputDisabled: false,
  contentClassName: '',
  notWandableMessage: DEFAULT_NOT_WANDABLE_MESSAGE,
  showQuoteButton: true,
}
