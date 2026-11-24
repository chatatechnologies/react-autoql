import { addRecentTopicSearch, getRecentTopicSearches } from './topicSearchHistory'

const authentication = { token: `x.${btoa(JSON.stringify({ user_id: 'u', project_id: 'p' }))}.y` }

const topic = { type: 'SUBJECT', context: 'acme', displayName: 'Acme' }
const value = { type: 'VL', displayName: 'Acme', valueLabel: { canonical: 'ACME CORP' } }

beforeEach(() => localStorage.clear())

test('a topic and a value with the same name are kept apart', () => {
  addRecentTopicSearch(authentication, topic)
  addRecentTopicSearch(authentication, value)
  expect(getRecentTopicSearches(authentication)).toEqual([value, topic])
})

test('searching the same thing again moves it to the top rather than repeating it', () => {
  addRecentTopicSearch(authentication, topic)
  addRecentTopicSearch(authentication, value)
  addRecentTopicSearch(authentication, { ...topic })
  expect(getRecentTopicSearches(authentication)).toEqual([topic, value])
})

test('keeps the three most recent', () => {
  ;['a', 'b', 'c', 'd'].forEach((context) =>
    addRecentTopicSearch(authentication, { type: 'SUBJECT', context, displayName: context }),
  )
  expect(getRecentTopicSearches(authentication).map((search) => search.context)).toEqual(['d', 'c', 'b'])
})
