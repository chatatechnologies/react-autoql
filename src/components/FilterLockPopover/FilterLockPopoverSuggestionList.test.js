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

describe('ambiguous values', () => {
  const advisorMatch = {
    keyword: 'Smith Family',
    format_txt: 'Smith Family',
    show_message: 'Advisor',
    canonical: 'advisor',
    column_name: 'advisor_name',
  }

  test('refuses to lock a value that matches two kinds of filter', async () => {
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [vlMatch, advisorMatch] } } })
    const wrapper = setup()

    await expect(wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })).rejects.toBeUndefined()
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('locks duplicates that would build the same filter', async () => {
    // Same canonical/column/category twice — nothing for the user to choose
    // between, so this is not ambiguous.
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [vlMatch, { ...vlMatch }] } } })
    const wrapper = setup()

    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })
    expect(setFilters.mock.calls[0][0].filters).toEqual([resolvedFilter])
    wrapper.unmount()
  })

  test('a show_message on the entry picks the right one', async () => {
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [advisorMatch, vlMatch] } } })
    const wrapper = setup({ suggestionList: [{ value: 'Smith Family', show_message: 'Household' }] })

    await wrapper.instance().setFilter({ value: 'Smith Family', show_message: 'Household', unresolved: true })

    expect(setFilters).toHaveBeenCalledTimes(1)
    expect(setFilters.mock.calls[0][0].filters[0].canonical_key).toBe('household_name')
    wrapper.unmount()
  })

  test('refuses two entities that share display text under one category', async () => {
    // Both match on format_txt; same canonical/column/category, different
    // keyword — so they build different locks and there is nothing to pick
    // between them.
    fetchVLAutocomplete.mockResolvedValue({
      data: {
        data: {
          matches: [
            { ...vlMatch, keyword: 'SMITH_01' },
            { ...vlMatch, keyword: 'SMITH_02' },
          ],
        },
      },
    })
    const wrapper = setup()

    await expect(wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })).rejects.toBeUndefined()
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('still locks when matches differ only in display text', async () => {
    // format_txt does not change what the filter does, so this is not
    // ambiguous.
    fetchVLAutocomplete.mockResolvedValue({
      data: { data: { matches: [vlMatch, { ...vlMatch, format_txt: 'Smith Family (2024)' }] } },
    })
    const wrapper = setup()

    await wrapper.instance().setFilter({ value: 'Smith Family', unresolved: true })
    expect(setFilters).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  test('a hint that matches nothing fails rather than falling back', async () => {
    // Only the Advisor match comes back for an entry tagged Household — the
    // hint must not widen to it.
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [advisorMatch] } } })
    const wrapper = setup({ suggestionList: [{ value: 'Smith Family', show_message: 'Household' }] })

    await expect(
      wrapper.instance().setFilter({ value: 'Smith Family', show_message: 'Household', unresolved: true }),
    ).rejects.toBeUndefined()
    expect(setFilters).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  test('the hint comparison ignores case and padding', async () => {
    fetchVLAutocomplete.mockResolvedValue({ data: { data: { matches: [advisorMatch, vlMatch] } } })
    const wrapper = setup({ suggestionList: [{ value: 'Smith Family', show_message: ' household ' }] })

    await wrapper.instance().setFilter({ value: 'Smith Family', show_message: ' household ', unresolved: true })

    expect(setFilters).toHaveBeenCalledTimes(1)
    expect(setFilters.mock.calls[0][0].filters[0].canonical_key).toBe('household_name')
    wrapper.unmount()
  })

  test('carries the category from the entry into the picked placeholder', () => {
    const wrapper = setup({ suggestionList: [{ value: 'Smith Family', show_message: 'Household' }] })
    const [suggestion] = wrapper.state('suggestions')

    expect(suggestion.name.show_message).toBe('Household')
    expect(wrapper.instance().getSuggestionValue(suggestion)).toEqual({
      value: 'Smith Family',
      show_message: 'Household',
      unresolved: true,
    })
    wrapper.unmount()
  })
})

describe('bounding what gets rendered', () => {
  const many = Array.from({ length: 150 }, (_, i) => `Household ${String(i).padStart(3, '0')}`)

  test('renders at most 100 matches', () => {
    const wrapper = setup({ suggestionList: many })
    expect(wrapper.state('suggestions')).toHaveLength(100)
    expect(wrapper.state('suggestionTotal')).toBe(150)
    wrapper.unmount()
  })

  test('says so in the heading rather than looking complete', () => {
    const wrapper = setup({ suggestionList: many, suggestionListTitle: 'Households' })
    expect(wrapper.instance().getSuggestionsTitle()).toBe('Households — first 100 of 150')
    wrapper.unmount()
  })

  test('leaves the heading alone when nothing was cut', () => {
    const wrapper = setup({ suggestionListTitle: 'Households' })
    expect(wrapper.instance().getSuggestionsTitle()).toBe('Households')
    wrapper.unmount()
  })
})

describe('headings', () => {
  test('the empty state uses the same heading, not Related to ""', () => {
    const wrapper = setup()
    wrapper.instance().fetchSuggestions({ value: 'zzzz' })
    const [section] = wrapper.instance().getSuggestions()

    expect(section.emptyState).toBe(true)
    expect(section.title).toBe('All values')
    wrapper.unmount()
  })

  test('falls back to the search phrasing once something is typed', () => {
    const wrapper = setup()
    wrapper.setState({ inputValue: 'smi' })
    expect(wrapper.instance().getSuggestionsTitle()).toBe('Related to "smi"')
    wrapper.unmount()
  })
})

describe('list identity', () => {
  test('an equal array literal is not treated as a new list', () => {
    const wrapper = setup()
    const instance = wrapper.instance()

    expect(instance.sameSuggestionList(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(instance.sameSuggestionList([{ value: 'a', show_message: 'H' }], [{ value: 'a', show_message: 'H' }])).toBe(
      true,
    )
    expect(instance.sameSuggestionList(['a', 'b'], ['a', 'c'])).toBe(false)
    expect(instance.sameSuggestionList(['a'], ['a', 'b'])).toBe(false)
    wrapper.unmount()
  })

  test('does not re-run the search when an equal list is passed again', () => {
    const wrapper = setup()
    const spy = jest.spyOn(wrapper.instance(), 'fetchSuggestions')

    wrapper.setProps({ suggestionList: [...suggestionList] })

    expect(spy).not.toHaveBeenCalled()
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
