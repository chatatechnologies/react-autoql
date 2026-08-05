import React from 'react'
import { shallow } from 'enzyme'

import { Button } from '../Button'
import { MagicWandBillingGateNotice } from './MagicWandBillingGateNotice'

describe('over_quota state', () => {
  test('renders the over-quota message and an increase-quota button when onIncreaseQuota is provided', () => {
    const onIncreaseQuota = jest.fn()
    const wrapper = shallow(
      <MagicWandBillingGateNotice state='over_quota' onIncreaseQuota={onIncreaseQuota} />,
    )

    expect(wrapper.find('.magic-wand-billing-gate-notice-over-quota').exists()).toBe(true)
    expect(wrapper.text()).toContain('Auto Analyze')
    expect(wrapper.find(Button).exists()).toBe(true)
  })

  test('omits the button when no onIncreaseQuota callback is supplied', () => {
    const wrapper = shallow(<MagicWandBillingGateNotice state='over_quota' />)

    expect(wrapper.find(Button).exists()).toBe(false)
  })
})

describe('unavailable state', () => {
  test('renders only the base message when billingExecutionType is unknown', () => {
    const onIncreaseQuota = jest.fn()
    const wrapper = shallow(
      <MagicWandBillingGateNotice state='unavailable' onIncreaseQuota={onIncreaseQuota} />,
    )

    expect(wrapper.text()).toContain('Auto Analyze')
    expect(wrapper.find(Button).exists()).toBe(false)
  })

  test('renders only the base message when billingExecutionType is EXPORT', () => {
    const onIncreaseQuota = jest.fn()
    const wrapper = shallow(
      <MagicWandBillingGateNotice
        state='unavailable'
        onIncreaseQuota={onIncreaseQuota}
        billingExecutionType='EXPORT'
      />,
    )

    expect(wrapper.find(Button).exists()).toBe(false)
  })

  test('shows a "Set up payment method" action when confirmed on the Stripe rail', () => {
    const onIncreaseQuota = jest.fn()
    const wrapper = shallow(
      <MagicWandBillingGateNotice
        state='unavailable'
        onIncreaseQuota={onIncreaseQuota}
        billingExecutionType='STRIPE'
      />,
    )

    const button = wrapper.find(Button)
    expect(button.exists()).toBe(true)
    expect(button.children().text()).toBe('Set up payment method')
    button.simulate('click')
    expect(onIncreaseQuota).toHaveBeenCalledTimes(1)
  })

  test('does not show the action when confirmed on Stripe but no callback is supplied', () => {
    const wrapper = shallow(
      <MagicWandBillingGateNotice state='unavailable' billingExecutionType='STRIPE' />,
    )

    expect(wrapper.find(Button).exists()).toBe(false)
  })
})

test('renders nothing for an unrecognized state', () => {
  const wrapper = shallow(<MagicWandBillingGateNotice state={undefined} />)
  expect(wrapper.isEmptyRender()).toBe(true)
})
