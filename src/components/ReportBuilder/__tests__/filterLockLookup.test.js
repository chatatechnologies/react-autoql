import { fetchVLAutocomplete } from 'autoql-fe-utils'
import { lookUpFilterLock } from '../run/filterLockLookup'

// A household picked by name (Select all, RW-371), looked up as its report is made, as the lock's picker looks up a
// value picked from its list.

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchVLAutocomplete: jest.fn(),
}))

const AUTH = { apiKey: 'k', domain: 'https://example.test', token: 't' }
const match = (keyword, rest = {}) => ({
  keyword,
  format_txt: keyword,
  canonical: 'household',
  column_name: 'household_name',
  show_message: 'Household',
  ...rest,
})
const answering = (matches) => fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches } } })

beforeEach(() => fetchVLAutocomplete.mockReset())

describe('lookUpFilterLock', () => {
  it('is the lock for the one value matching the name exactly, whatever its case or padding', async () => {
    answering([match('Brown Family Trust'), match('Brown Family')])
    await expect(lookUpFilterLock({ authentication: AUTH, value: ' brown family ' })).resolves.toStrictEqual({
      key: 'household',
      value: 'Brown Family',
      filter_type: 'include',
      canonical_key: 'household_name',
      format_txt: 'Brown Family',
      show_message: 'Household',
    })
    expect(fetchVLAutocomplete).toHaveBeenCalledWith(
      expect.objectContaining({ suggestion: ' brown family ', token: 't' }),
    )
  })

  it('matches on the text shown, too, and takes two matches making the same lock as one', async () => {
    answering([match('HH-17', { format_txt: 'Brown Family' }), match('HH-17', { format_txt: 'Brown Family' })])
    await expect(lookUpFilterLock({ authentication: AUTH, value: 'Brown Family' })).resolves.toMatchObject({
      value: 'HH-17',
    })
  })

  it('fails as not found where nothing matches exactly, and as ambiguous where two different ones do', async () => {
    answering([match('Brown Family Trust')])
    await expect(lookUpFilterLock({ authentication: AUTH, value: 'Brown Family' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    answering([match('Brown Family'), match('Brown Family', { canonical: 'client' })])
    await expect(lookUpFilterLock({ authentication: AUTH, value: 'Brown Family' })).rejects.toMatchObject({
      code: 'AMBIGUOUS',
    })
  })
})
