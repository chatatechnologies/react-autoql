import { getMagicWandBillingErrorState } from '../magicWandBillingErrors'

describe('getMagicWandBillingErrorState', () => {
  it('classifies a ceiling-reached response as over_quota', () => {
    const error = {
      reference_id: '1.1.993',
      message: 'MagicWand monthly usage quota has been reached. Raise the quota to continue.',
      data: { code: 'BILLING_USAGE_CEILING_REACHED', outcome: 'BLOCK_CEILING_EXCEEDED' },
    }
    expect(getMagicWandBillingErrorState(error)).toBe('over_quota')
  })

  it('classifies a usage-unavailable response as unavailable', () => {
    const error = {
      reference_id: '1.1.993',
      message: 'Unable to verify current MagicWand billing usage. Please retry.',
      data: { code: 'BILLING_USAGE_UNAVAILABLE', outcome: 'BILLING_USAGE_UNAVAILABLE' },
    }
    expect(getMagicWandBillingErrorState(error)).toBe('unavailable')
  })

  it('classifies a no-billing-context response (empty data, matching message) as unavailable, not over_quota', () => {
    const error = {
      reference_id: '1.1.993',
      message: 'Billing is required for this request. A valid billing customer key is not configured.',
      data: {},
    }
    expect(getMagicWandBillingErrorState(error)).toBe('unavailable')
  })

  it('returns null for an unrelated/unrecognized error so callers fall back to their default handling', () => {
    expect(getMagicWandBillingErrorState({ message: 'Network Error' })).toBeNull()
    expect(getMagicWandBillingErrorState({ data: { code: 'SOMETHING_ELSE' } })).toBeNull()
    expect(getMagicWandBillingErrorState(undefined)).toBeNull()
  })

  it('does not classify a ceiling-reached code without the matching outcome', () => {
    const error = { data: { code: 'BILLING_USAGE_CEILING_REACHED', outcome: 'SOMETHING_ELSE' } }
    expect(getMagicWandBillingErrorState(error)).toBeNull()
  })
})
