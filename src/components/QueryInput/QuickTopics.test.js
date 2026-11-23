import React from 'react'
import { shallow } from 'enzyme'
import { fetchDataPreview } from 'autoql-fe-utils'

import QueryInput from './QueryInput'
import SampleQueryList from '../DataExplorer/SampleQueryList'
import DataPreview from '../DataExplorer/DataPreview'

jest.mock('autoql-fe-utils', () => ({
  ...jest.requireActual('autoql-fe-utils'),
  fetchDataPreview: jest.fn(() => new Promise(() => {})),
}))

jest.mock('../../js/subjectListService', () => ({
  fetchSubjectListCached: jest.fn(() => new Promise(() => {})),
}))

const topic = { context: 'transfers', displayName: 'Transfers' }

const setup = (props = {}) => {
  const wrapper = shallow(<QueryInput {...QueryInput.defaultProps} {...props} />).dive()
  wrapper.setState({ topics: [topic] })
  return wrapper
}

const openTopic = (wrapper) => {
  wrapper.instance().onTopicClick(topic)
  wrapper.update()
}

beforeEach(() => fetchDataPreview.mockClear())

describe('Quick Topics panel gating (the same rule the Data Explorer had)', () => {
  test('sample queries when enabled and column selection is allowed', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    openTopic(wrapper)
    expect(wrapper.find(SampleQueryList).exists()).toBe(true)
    expect(wrapper.find(DataPreview).exists()).toBe(false)
  })

  test('only the data preview when sample queries are off', () => {
    const wrapper = setup({ enableTopicSampleQueries: false })
    openTopic(wrapper)
    expect(wrapper.find(SampleQueryList).exists()).toBe(false)
    expect(wrapper.find(DataPreview).exists()).toBe(true)
  })

  test('only the data preview for LLM projects (column selection disabled), even with sample queries on', () => {
    const wrapper = setup({ enableTopicSampleQueries: true, disableColumnSelection: true })
    openTopic(wrapper)
    expect(wrapper.find(SampleQueryList).exists()).toBe(false)
    expect(wrapper.find(DataPreview).exists()).toBe(true)
  })
})

describe('Quick Topics sample queries', () => {
  test('fetch enough preview rows to pick example values from', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    openTopic(wrapper)
    expect(fetchDataPreview).toHaveBeenCalledTimes(1)
    expect(fetchDataPreview.mock.calls[0][0]).toMatchObject({ subject: 'transfers', numRows: 20 })
  })

  test('do not fetch a preview of their own when only the DataPreview is shown', () => {
    const wrapper = setup({ enableTopicSampleQueries: false })
    openTopic(wrapper)
    expect(fetchDataPreview).not.toHaveBeenCalled()
  })

  test('fill picked fields with example values from the preview', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    openTopic(wrapper)
    wrapper.setState({
      dataPreview: {
        data: {
          data: {
            columns: [{ name: 'wallet', type: 'STRING' }],
            rows: [[null], ['Acme'], ['Globex']],
          },
        },
      },
      selectedColumns: [0],
    })

    expect(wrapper.find(SampleQueryList).prop('columns')).toEqual({ wallet: { value: 'Acme' } })
  })
})

describe('Quick Topics search', () => {
  const findPanel = (wrapper) => wrapper.find('TopicSearchPanel')
  const findField = (wrapper) => wrapper.find('TopicSearchField')
  const findButton = (wrapper) => wrapper.find('[data-test="quick-topics-search-button"]')
  const value = { type: 'VL', displayName: 'Acme', valueLabel: { canonical: 'acme' } }

  test('LLM projects (column selection disabled) get no search at all', () => {
    const wrapper = setup({ disableColumnSelection: true })
    expect(findButton(wrapper).exists()).toBe(false)

    wrapper.instance().openTopicSearch()
    wrapper.update()
    expect(findField(wrapper).exists()).toBe(false)
    expect(findPanel(wrapper).exists()).toBe(false)
  })

  test('the search button swaps the chips for a search field and opens the results', () => {
    const wrapper = setup()
    findButton(wrapper).simulate('click')
    expect(findField(wrapper).exists()).toBe(true)
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(false)
    expect(findPanel(wrapper).prop('selection')).toBeNull()
  })

  test('picking a result shows it in the panel; back returns to the results', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch()
    wrapper.update()

    findPanel(wrapper).prop('onSelect')(value)
    wrapper.update()
    expect(findPanel(wrapper).prop('selection')).toBe(value)
    expect(findPanel(wrapper).prop('showSampleQueries')).toBe(true)
    expect(wrapper.state('topicSearchQuery')).toBe('Acme')

    findPanel(wrapper).prop('onBack')()
    wrapper.update()
    expect(findPanel(wrapper).prop('selection')).toBeNull()
  })

  test('a picked topic is the live topic, even from a recent search stored as JSON', () => {
    const wrapper = setup()
    wrapper.instance().openTopicSearch()
    wrapper.instance().onTopicSearchSelect(JSON.parse(JSON.stringify(topic)))
    expect(wrapper.state('topicSearchSelection')).toBe(topic)
  })

  test('Enter picks an exact topic name, otherwise the first result', () => {
    const wrapper = setup()
    wrapper.instance().openTopicSearch()
    wrapper.instance().submitTopicSearch('transfers')
    expect(wrapper.state('topicSearchSelection')).toBe(topic)

    wrapper.instance().onTopicSearchChange('acm')
    wrapper.instance().topicSearchResultsRef.current = { firstResult: value }
    wrapper.instance().submitTopicSearch('acm')
    expect(wrapper.state('topicSearchSelection')).toBe(value)
  })

  test('submitting a query clears the search and brings the chips back', () => {
    const wrapper = setup({ onSubmit: jest.fn() })
    wrapper.instance().openTopicSearch()
    wrapper.instance().onTopicSearchChange('acm')
    wrapper.instance().onTopicSearchSelect(topic)

    wrapper.instance().submitQuery({ queryText: 'total transfers by wallet' })
    wrapper.update()
    expect(wrapper.state('isSearchingTopics')).toBe(false)
    expect(wrapper.state('topicSearchQuery')).toBe('')
    expect(wrapper.state('topicSearchSelection')).toBeNull()
    expect(findField(wrapper).exists()).toBe(false)
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(true)
  })

  test('closing the search brings the chips back', () => {
    const wrapper = setup()
    wrapper.instance().openTopicSearch()
    wrapper.instance().closeTopicSearch()
    wrapper.update()
    expect(findField(wrapper).exists()).toBe(false)
    expect(findPanel(wrapper).exists()).toBe(false)
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(true)
  })
})
