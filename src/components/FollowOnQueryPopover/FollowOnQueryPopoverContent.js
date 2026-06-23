import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { Input } from '../Input'

import './FollowOnQueryPopover.scss'

export default function FollowOnQueryPopoverContent({
  queryText,
  onQueryTextChange,
  onSubmit,
  onKeyDown,
  isLoading,
  error,
  isDisabled,
}) {
  return (
    <div className='follow-on-query-popover-content'>
      <div className='follow-on-query-popover-header'>
        <label className='follow-on-query-popover-label'>Ask a follow-up question</label>
      </div>
      <div className='follow-on-query-popover-input-wrapper'>
        <Input
          value={queryText}
          onChange={onQueryTextChange}
          onKeyDown={onKeyDown}
          placeholder='e.g., "Which date has the highest value?"'
          disabled={isLoading}
          style={{ width: '100%' }}
        />
      </div>
      {error && <div className='follow-on-query-popover-error'>{error}</div>}
      <div className='follow-on-query-popover-actions'>
        <Button
          type='primary'
          size='medium'
          icon='reply'
          onClick={onSubmit}
          disabled={isDisabled || !queryText?.trim()}
          loading={isLoading}
        >
          Run
        </Button>
      </div>
    </div>
  )
}

FollowOnQueryPopoverContent.propTypes = {
  queryText: PropTypes.string,
  onQueryTextChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  isDisabled: PropTypes.bool,
}

FollowOnQueryPopoverContent.defaultProps = {
  queryText: '',
  onKeyDown: undefined,
  isLoading: false,
  error: null,
  isDisabled: false,
}
