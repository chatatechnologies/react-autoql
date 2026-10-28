import { buildValueActionUrl, getValueAction, getValueActionTooltip, runValueActionCallback } from './valueActions'

const linkColumn = (link) => ({ name: 'account_id', value_action: { type: 'link', ...link } })
const callbackColumn = (callback_name) => ({ name: 'account_name', value_action: { type: 'callback', callback_name } })

describe('getValueAction', () => {
  test('reads a link action', () => {
    expect(getValueAction(linkColumn({ link_url: 'https://crm.acme.com/{value}', link_target: '_self' }))).toEqual({
      type: 'link',
      url: 'https://crm.acme.com/{value}',
      target: '_self',
    })
  })

  test('defaults the link target to a new tab', () => {
    expect(getValueAction(linkColumn({ link_url: 'https://crm.acme.com/{value}' })).target).toBe('_blank')
  })

  test('reads a callback action', () => {
    expect(getValueAction(callbackColumn('openCustomerDrawer'))).toEqual({
      type: 'callback',
      name: 'openCustomerDrawer',
    })
  })

  test('is undefined for a null, missing or malformed value_action', () => {
    expect(getValueAction({ name: 'region', value_action: null })).toBeUndefined()
    expect(getValueAction({ name: 'region' })).toBeUndefined()
    expect(getValueAction(undefined)).toBeUndefined()
    expect(getValueAction({ value_action: { type: 'link' } })).toBeUndefined()
    expect(getValueAction({ value_action: { type: 'callback', callback_name: '' } })).toBeUndefined()
  })

  test('is undefined when the type does not match the fields or is unknown', () => {
    expect(
      getValueAction({ value_action: { type: 'callback', link_url: 'https://crm.acme.com/{value}' } }),
    ).toBeUndefined()
    expect(getValueAction({ value_action: { type: 'link', callback_name: 'openCustomerDrawer' } })).toBeUndefined()
    expect(
      getValueAction({ value_action: { type: 'email', link_url: 'https://crm.acme.com/{value}' } }),
    ).toBeUndefined()
    expect(getValueAction({ value_action: { link_url: 'https://crm.acme.com/{value}' } })).toBeUndefined()
  })
})

describe('buildValueActionUrl', () => {
  test('puts the value into the template', () => {
    expect(buildValueActionUrl('https://crm.acme.com/accounts/{value}', 1042)).toBe(
      'https://crm.acme.com/accounts/1042',
    )
  })

  test('URL-encodes the value and replaces every placeholder', () => {
    expect(buildValueActionUrl('https://crm.acme.com/{value}?q={value}', 'A&B / C')).toBe(
      'https://crm.acme.com/A%26B%20%2F%20C?q=A%26B%20%2F%20C',
    )
  })

  test('refuses anything that is not http or https', () => {
    expect(buildValueActionUrl('javascript:alert({value})', 1)).toBeUndefined()
    expect(buildValueActionUrl('data:text/html,{value}', 1)).toBeUndefined()
  })

  test('is undefined for an empty value', () => {
    expect(buildValueActionUrl('https://crm.acme.com/{value}', null)).toBeUndefined()
    expect(buildValueActionUrl('https://crm.acme.com/{value}', '')).toBeUndefined()
  })
})

describe('getValueActionTooltip', () => {
  test('says a new tab for a _blank link', () => {
    expect(getValueActionTooltip({ type: 'link', target: '_blank' })).toBe('Open in new tab')
  })

  test('says open for a same-tab link or a callback', () => {
    expect(getValueActionTooltip({ type: 'link', target: '_self' })).toBe('Open')
    expect(getValueActionTooltip({ type: 'callback', name: 'openCustomerDrawer' })).toBe('Open')
  })

  test('uses the tooltip the host app gives for a callback', () => {
    const action = { type: 'callback', name: 'openCustomerDrawer' }
    const callbacks = { openCustomerDrawer: { onClick: () => {}, tooltip: 'View customer' } }
    expect(getValueActionTooltip(action, callbacks)).toBe('View customer')
  })

  test('falls back to open when the callback is a plain function or the tooltip is empty', () => {
    const action = { type: 'callback', name: 'openCustomerDrawer' }
    expect(getValueActionTooltip(action, { openCustomerDrawer: () => {} })).toBe('Open')
    expect(getValueActionTooltip(action, { openCustomerDrawer: { onClick: () => {}, tooltip: '' } })).toBe('Open')
  })
})

describe('runValueActionCallback', () => {
  const action = { type: 'callback', name: 'openCustomerDrawer' }

  test('calls onClick when the callback is given as { onClick, tooltip }', () => {
    const onClick = jest.fn()
    const row = { account_name: 'Acme' }
    const context = { queryId: 'q1' }

    runValueActionCallback({
      action,
      value: 'Acme',
      row,
      context,
      callbacks: { openCustomerDrawer: { onClick, tooltip: 'View customer' } },
    })

    expect(onClick).toHaveBeenCalledWith('Acme', row, context)
  })

  test('calls the matching callback with the value, row and context', () => {
    const openCustomerDrawer = jest.fn()
    const row = { account_id: 1042, account_name: 'Acme' }

    const context = { queryId: 'q1' }

    runValueActionCallback({ action, value: 'Acme', row, context, callbacks: { openCustomerDrawer } })

    expect(openCustomerDrawer).toHaveBeenCalledWith('Acme', row, context)
  })

  test('does nothing for an unknown callback', () => {
    const other = jest.fn()
    expect(() => runValueActionCallback({ action, value: 'Acme', row: {}, callbacks: { other } })).not.toThrow()
    expect(other).not.toHaveBeenCalled()
  })

  test('does nothing when no callbacks are given', () => {
    expect(() => runValueActionCallback({ action, value: 'Acme', row: {} })).not.toThrow()
  })
})
