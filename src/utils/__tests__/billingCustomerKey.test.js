import {
  clearStoredBillingCustomerKey,
  getStoredBillingCustomerKey,
  setStoredBillingCustomerKey,
} from '../billingCustomerKey'

describe('billingCustomerKey storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores keys separately by API key', () => {
    setStoredBillingCustomerKey('bck_one_ABCDEFGH', 'api-one')
    setStoredBillingCustomerKey('bck_two_ABCDEFGH', 'api-two')

    expect(getStoredBillingCustomerKey('api-one')).toBe('bck_one_ABCDEFGH')
    expect(getStoredBillingCustomerKey('api-two')).toBe('bck_two_ABCDEFGH')
  })

  it('clears the requested key', () => {
    setStoredBillingCustomerKey('bck_one_ABCDEFGH', 'api-one')
    clearStoredBillingCustomerKey('api-one')
    expect(getStoredBillingCustomerKey('api-one')).toBeNull()
  })
})
