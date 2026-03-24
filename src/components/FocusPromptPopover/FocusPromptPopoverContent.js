import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { Input } from '../Input'

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
          placeholder='e.g., sales growth trends'
          maxLength={100}
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
            <div className='focus-prompt-popover-estimated-cost-price'>
              ${Number(quoteResult.cost).toFixed(2)}
            </div>
          </div>
        ) : (
          <div className='focus-prompt-popover-not-wandable'>
            Analysis is not available for this dataset.
          </div>
        ))}
      {focusError && <div className='focus-prompt-popover-error'>{focusError}</div>}
      <div className='focus-prompt-popover-actions'>
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
        <Button
          type='primary'
          size='medium'
          icon='magic-wand'
          onClick={onAnalyze}
          disabled={isAnalyzeDisabled || (quoteResult && !quoteResult.wandable)}
          loading={isAnalyzeLoading}
        >
          Analyze
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
}
