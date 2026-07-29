import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { MAGIC_WAND_BILLING_GATE_MESSAGES } from '../../hooks/billing'

import './MagicWandBillingGateNotice.scss'

export const MagicWandBillingGateNotice = ({ state, onIncreaseQuota, billingExecutionType }) => {
  if (state === 'over_quota') {
    return (
      <div className='magic-wand-billing-gate-notice magic-wand-billing-gate-notice-over-quota'>
        <p className='magic-wand-billing-gate-notice-message'>
          {MAGIC_WAND_BILLING_GATE_MESSAGES.over_quota_summary}
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
    // Only offer the payment-method shortcut when we're certain this account is on the
    // Stripe rail — customers on the export rail don't manage payment methods here.
    const showSetUpPaymentMethod = billingExecutionType === 'STRIPE' && !!onIncreaseQuota

    return (
      <div className='magic-wand-billing-gate-notice magic-wand-billing-gate-notice-unavailable'>
        <p className='magic-wand-billing-gate-notice-message'>{MAGIC_WAND_BILLING_GATE_MESSAGES.unavailable}</p>
        {showSetUpPaymentMethod && (
          <div className='magic-wand-billing-gate-notice-actions'>
            <Button type='primary' size='small' onClick={onIncreaseQuota}>
              Set up payment method
            </Button>
            <p className='magic-wand-billing-gate-notice-passive-action'>
              If you haven&apos;t set up a payment method yet, add one to continue using Auto Analyze.
            </p>
          </div>
        )}
      </div>
    )
  }

  return null
}

MagicWandBillingGateNotice.propTypes = {
  state: PropTypes.oneOf(['over_quota', 'unavailable']),
  onIncreaseQuota: PropTypes.func,
  billingExecutionType: PropTypes.oneOf(['STRIPE', 'EXPORT']),
}

MagicWandBillingGateNotice.defaultProps = {
  state: undefined,
  onIncreaseQuota: undefined,
  billingExecutionType: undefined,
}
