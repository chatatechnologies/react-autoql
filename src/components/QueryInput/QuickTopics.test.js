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

  test('the search button swaps the chips for a search field and opens the results', () => {
    const wrapper = setup()
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(true)

    wrapper.find('[data-test="quick-topics-search-button"]').simulate('click')
    expect(findField(wrapper).exists()).toBe(true)
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(false)
    expect(findPanel(wrapper).exists()).toBe(true)
  })

  test('LLM projects search topics only; others search values too', () => {
    const llm = setup({ disableColumnSelection: true })
    llm.instance().openTopicSearch()
    llm.update()
    expect(findPanel(llm).prop('searchValues')).toBe(false)

    const other = setup()
    other.instance().openTopicSearch()
    other.update()
    expect(findPanel(other).prop('searchValues')).toBe(true)
  })

  test('Enter on an exact topic name opens that topic', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch()
    wrapper.instance().submitTopicSearch('transfers')
    wrapper.update()
    expect(wrapper.state('selectedTopic')).toBe(topic)
    expect(findPanel(wrapper).exists()).toBe(false)
  })

  test('Enter on other text shows its sample queries when the project has them', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch()
    wrapper.instance().submitTopicSearch('fees by wallet')
    expect(wrapper.state('topicSearchSelection')).toMatchObject({
      type: 'TEXT',
      displayName: 'fees by wallet',
      skipValidation: false,
    })
  })

  test('Enter does nothing for text that matches nothing on an LLM project', () => {
    const wrapper = setup({ disableColumnSelection: true, enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch()
    wrapper.instance().submitTopicSearch('fees by wallet')
    expect(wrapper.state('topicSearchSelection')).toBeNull()
    expect(wrapper.state('selectedTopic')).toBeNull()
  })

  test('opening the search with text searches it straight away, without a spelling check', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch('fees by wallet')
    expect(wrapper.state('topicSearchSelection')).toMatchObject({ type: 'TEXT', skipValidation: true })
    expect(wrapper.state('topicSearchQuery')).toBe('fees by wallet')
  })

  test('closing a topic opened from the search goes back to the results', () => {
    const wrapper = setup({ enableTopicSampleQueries: true })
    wrapper.instance().openTopicSearch()
    wrapper.instance().onTopicSearchSelect(topic)
    wrapper.update()
    expect(findPanel(wrapper).exists()).toBe(false)

    wrapper.instance().closeTopic()
    wrapper.update()
    expect(findPanel(wrapper).exists()).toBe(true)
  })

  test('closing the search brings the chips back', () => {
    const wrapper = setup()
    wrapper.instance().openTopicSearch('wal')
    wrapper.instance().closeTopicSearch()
    wrapper.update()
    expect(findField(wrapper).exists()).toBe(false)
    expect(findPanel(wrapper).exists()).toBe(false)
    expect(wrapper.find('.query-suggestion-button').exists()).toBe(true)
  })
})
