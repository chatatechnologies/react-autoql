import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { MAGIC_WAND_BILLING_GATE_MESSAGES } from '../../hooks/billing'

import './MagicWandBillingGateNotice.scss'

export const MagicWandBillingGateNotice = ({ state, onIncreaseQuota }) => {
  if (state === 'over_quota') {
    return (
      <div className='magic-wand-billing-gate-notice magic-wand-billing-gate-notice-over-quota'>
        <p className='magic-wand-billing-gate-notice-message'>
          Your most recent MagicWand usage put this account at or over its monthly quota.
        </p>
        <div className='magic-wand-billing-gate-notice-actions'>
          {onIncreaseQuota && (
            <Button type='primary' size='small' onClick={onIncreaseQuota}>
              Increase monthly quota
            </Button>
          )}
          <p className='magic-wand-billing-gate-notice-passive-action'>
            Or wait until your next billing period, when usage resets.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div className='magic-wand-billing-gate-notice magic-wand-billing-gate-notice-unavailable'>
        <p className='magic-wand-billing-gate-notice-message'>{MAGIC_WAND_BILLING_GATE_MESSAGES.unavailable}</p>
      </div>
    )
  }

  return null
}

MagicWandBillingGateNotice.propTypes = {
  state: PropTypes.oneOf(['over_quota', 'unavailable']),
  onIncreaseQuota: PropTypes.func,
}

MagicWandBillingGateNotice.defaultProps = {
  state: undefined,
  onIncreaseQuota: undefined,
}
