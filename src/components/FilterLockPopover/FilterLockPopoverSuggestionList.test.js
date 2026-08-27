import React from 'react'
import { mount } from 'enzyme'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchVLAutocomplete: jest.fn(),
  setFilters: jest.fn(),
}))

import { fetchVLAutocomplete, setFilters } from 'autoql-fe-utils'
import FilterLockPopoverContent from './FilterLockPopoverContent'

const sampleAuth = { apiKey: 'testKey', domain: 'http://www.test.com', token: 'rand0mtok3n' }
const suggestionList = ['Smith Family', 'Anderson Charities', 'Chen Family Foundation']

/** One value-label autocomplete match — the shape a filter is built from. */
const vlMatch = {
  keyword: 'Smith Family',
  format_txt: 'Smith Family',
  show_message: 'Household',
  canonical: 'household',
  column_name: 'household_name',
}

/** What createNewFilterFromSuggestion turns `vlMatch` into. */
const resolvedFilter = {
  value: 'Smith Family',
  format_txt: 'Smith Family',
  show_message: 'Household',
  key: 'household',
  filter_type: 'include',
  canonical_key: 'household_name',
}

const setup = (props = {}) =>
  mount(<FilterLockPopoverContent authentication={sampleAuth} isOpen suggestionList={suggestionList} {...props} />)

beforeEach(() => {
  jest.clearAllMocks()
  fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [vlMatch] } } })
  setFilters.mockResolvedValue({ data: { data: { data: [resolvedFilter] } } })
})

describe('suggestionList replaces the value-label autocomplete', () => {
  test('shows the whole list on open without calling the API', () => {
    const wrapper = setup()
    expect(wrapper.state('suggestions').map((s) => s.name.keyword)).toEqual([
      'Anderson Charities',
      'Chen Family Foundation',
      'Smith Family',
    ])
    expect(fetchVLAutocomplete).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('marks injected entries unresolved and carries the match ranges', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'chen' })
    const [suggestion] = wrapper.state('suggestions')
    expect(suggestion.name).toEqual({ keyword: 'Chen Family Foundation', ranges: [[0, 4]], unresolved: true })
    wrapper.unmount()
  })

  test('narrows the list locally as the user types', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'smth' })
    expect(wrapper.state('suggestions').map((s) => s.name.keyword)).toEqual(['Smith Family'])
    expect(fetchVLAutocomplete).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('renders every value again when the input is cleared', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'smth' })
    expect(wrapper.state('suggestions')).toHaveLength(1)

    wrapper.instance().fetchSuggestions({ value: '' })
    expect(wrapper.state('suggestions')).toHaveLength(3)
    wrapper.unmount()
  })

  test('does not empty the list on pick, which would flicker it shut and open', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'smth' })

    // react-autosuggest fires this on every selection.
    wrapper.instance().onSuggestionsClearRequested()

    expect(wrapper.state('suggestions')).toHaveLength(1)
    wrapper.unmount()
  })

  test('shows suggestions before anything is typed', () => {
    const wrapper = setup()
    expect(wrapper.instance().shouldRenderSuggestions('', 'input-focused')).toBe(true)
    expect(wrapper.instance().shouldRenderSuggestions('', 'render')).toBe(true)
    wrapper.unmount()
  })

  test('refuses the auto-reveal that would reopen the list after a pick', () => {
    // react-autosuggest re-reveals a collapsed dropdown whenever the
    // suggestions array changes identity, which happens on every render.
    const wrapper = setup()
    expect(wrapper.instance().shouldRenderSuggestions('', 'suggestions-updated')).toBe(false)
    wrapper.unmount()
  })

  test('leaves the default autocomplete gated on a non-empty input', () => {
    const wrapper = mount(<FilterLockPopoverContent authentication={sampleAuth} isOpen />)
    expect(wrapper.instance().shouldRenderSuggestions('', 'input-focused')).toBe(false)
    expect(wrapper.instance().shouldRenderSuggestions('smi', 'input-focused')).toBe(true)
    wrapper.unmount()
  })

  test('drops the previous query’s matches once the input is reset', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'smth' })
    expect(wrapper.state('suggestions')).toHaveLength(1)

    // What setFilter does on success.
    wrapper.setState({ inputValue: 'smth' })
    wrapper.setState({ inputValue: '' })

    expect(wrapper.state('suggestions')).toHaveLength(3)
    expect(wrapper.state('suggestions')[0].name.ranges).toEqual([])
    wrapper.unmount()
  })

  test('hands react-autosuggest a placeholder, since resolving needs a round trip', () => {
    const wrapper = setup()
    const value = wrapper.instance().getSuggestionValue({ name: { keyword: 'Smith Family', unresolved: true } })
    expect(value).toEqual({ value: 'Smith Family', unresolved: true })
    wrapper.unmount()
  })
})

describe('resolving a picked value', () => {
  test('looks the value up and saves the filter the lookup returns', async () => {
    const wrapper = setup()
    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })

    expect(fetchVLAutocomplete).toHaveBeenCalledTimes(1)
    expect(fetchVLAutocomplete.mock.calls[0][0]).toMatchObject({ suggestion: 'Smith Family' })
    expect(setFilters).toHaveBeenCalledTimes(1)
    expect(setFilters.mock.calls[0][0].filters).toEqual([resolvedFilter])
    wrapper.unmount()
  })

  test('adds the resolved filter to the locked list', async () => {
    const wrapper = setup()
    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })
    expect(wrapper.state('filters')).toEqual([resolvedFilter])
    wrapper.unmount()
  })

  test('does not save anything when the value has no exact match', async () => {
    fetchVLAutocomplete.mockResolvedValue({
      data: { data: { matches: [{ ...vlMatch, keyword: 'Smithe Family', format_txt: 'Smithe Family' }] } },
    })
    const wrapper = setup()

    await expect(wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })).rejects.toBeUndefined()
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('saves nothing when the lookup comes back empty', async () => {
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [] } } })
    const wrapper = setup()

    await expect(wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })).rejects.toBeUndefined()
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('matches on display text, and locks the underlying value it maps to', async () => {
    // The injected list is display text as far as this component knows. When it
    // matches `format_txt` rather than `keyword`, the filter is still built from
    // the canonical `keyword` — that is the value the query API expects.
    fetchVLAutocomplete.mockResolvedValue({
      data: { data: { matches: [{ ...vlMatch, keyword: 'SMITH_FAMILY_01' }] } },
    })
    setFilters.mockResolvedValue({ data: { data: { data: [{ ...resolvedFilter, value: 'SMITH_FAMILY_01' }] } } })
    const wrapper = setup()

    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })
    expect(setFilters.mock.calls[0][0].filters[0].value).toBe('SMITH_FAMILY_01')
    wrapper.unmount()
  })

  test('does not save the same filter twice', async () => {
    const wrapper = setup({ initialFilters: [resolvedFilter] })
    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })

    expect(fetchVLAutocomplete).toHaveBeenCalledTimes(1)
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('without suggestionList', () => {
  test('still uses the value-label autocomplete', () => {
    const wrapper = mount(<FilterLockPopoverContent authentication={sampleAuth} isOpen />)
    wrapper.instance().fetchSuggestions({ value: 'smi' })
    expect(fetchVLAutocomplete).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
