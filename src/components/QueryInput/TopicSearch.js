import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import PropTypes from 'prop-types'
import {
  DataExplorerTypes,
  REQUEST_CANCELLED_ERROR,
  fetchDataExplorerAutocomplete,
  fetchSubjectListV2,
  getAuthentication,
  runQueryValidation,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { LoadingDots } from '../LoadingDots'
import { CustomScrollbars } from '../CustomScrollbars'
import { SubjectName } from '../DataExplorer/SubjectName'
import SampleQueryList from '../DataExplorer/SampleQueryList'
import { QueryValidationMessage } from '../QueryValidationMessage'
import { addRecentTopicSearch, clearRecentTopicSearches, getRecentTopicSearches } from '../../js/topicSearchHistory'
import { authenticationType } from '../../props/types'

const AUTOCOMPLETE_DELAY_MS = 200

const normalize = (text) => `${text ?? ''}`.trim().toLowerCase()

/** Topics whose name contains the text, for the local filter. */
export const filterTopics = (topics, text) => {
  const query = normalize(text)
  return query ? topics.filter((topic) => normalize(topic.displayName).includes(query)) : topics
}

// A topic narrowed to a searched value. Copied with its prototype, since topics are
// DataExplorerSubject instances whose methods are used downstream.
export const withValueLabel = (topic, valueLabel) =>
  Object.assign(Object.create(Object.getPrototypeOf(topic)), topic, { valueLabel })

// The Quick Topics search box. Takes the place of the topic chips while searching.
export const TopicSearchField = ({ value, placeholder, onChange, onSubmit, onClose, onFocus }) => (
  <div className='quick-topics-search-field' data-test='quick-topics-search-field'>
    <Icon type='search' />
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit(value)
        } else if (e.key === 'Escape') {
          // Escape in the query input cancels the running query; here it only closes the search.
          e.stopPropagation()
          onClose()
        }
      }}
    />
    <button type='button' className='quick-topics-search-close' onClick={onClose} aria-label='Close search'>
      <Icon type='close' />
    </button>
  </div>
)

TopicSearchField.propTypes = {
  value: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onFocus: PropTypes.func,
}

const ResultSection = ({ title, action, children }) => (
  <div className='quick-topics-search-section'>
    <div className='quick-topics-search-section-title'>
      <strong>{title}</strong>
      {action}
    </div>
    {children}
  </div>
)

const ResultItem = ({ item, label, onClick }) => (
  <button type='button' className='quick-topics-search-result' onClick={() => onClick(item)}>
    {label ?? <SubjectName subject={item} />}
  </button>
)

// What the search finds while typing: recent searches, topics, values (and, for
// projects with sample queries, the text itself). Picking one calls onSelect.
const TopicSearchResults = ({ authentication, topics, query, searchValues, allowTextSearch, onSelect }) => {
  const [recentSearches, setRecentSearches] = useState(() => getRecentTopicSearches(authentication))
  const [autocomplete, setAutocomplete] = useState({ text: undefined, suggestions: [], loading: false })

  useEffect(() => {
    const text = query?.trim()
    if (!searchValues || !text) {
      setAutocomplete({ text: undefined, suggestions: [], loading: false })
      return
    }

    setAutocomplete((current) => ({ ...current, loading: true }))
    const source = axios.CancelToken?.source()
    const timer = setTimeout(() => {
      fetchDataExplorerAutocomplete({
        suggestion: text,
        ...getAuthentication(authentication),
        cancelToken: source?.token,
      })
        .then((suggestions) => setAutocomplete({ text, suggestions: suggestions ?? [], loading: false }))
        .catch((error) => {
          if (error?.data?.message !== REQUEST_CANCELLED_ERROR && error?.message !== REQUEST_CANCELLED_ERROR) {
            console.error(error)
            setAutocomplete({ text, suggestions: [], loading: false })
          }
        })
    }, AUTOCOMPLETE_DELAY_MS)

    return () => {
      clearTimeout(timer)
      source?.cancel(REQUEST_CANCELLED_ERROR)
    }
  }, [query, searchValues])

  const select = (item) => {
    setRecentSearches(addRecentTopicSearch(authentication, item))
    onSelect(item)
  }

  const text = query?.trim()

  if (!text) {
    return (
      <>
        {!!recentSearches.length && (
          <ResultSection
            title='Recent'
            action={
              <button
                type='button'
                className='quick-topics-search-clear-history'
                onClick={() => setRecentSearches(clearRecentTopicSearches(authentication))}
              >
                Clear history
              </button>
            }
          >
            {recentSearches.map((item, i) => (
              <ResultItem key={`recent-${i}`} item={item} onClick={select} />
            ))}
          </ResultSection>
        )}
        <ResultSection title='Topics'>
          {topics.map((topic, i) => (
            <ResultItem key={`topic-${i}-${topic.context}`} item={topic} onClick={select} />
          ))}
        </ResultSection>
      </>
    )
  }

  const textSearch = allowTextSearch ? (
    <ResultItem
      item={{ type: DataExplorerTypes.TEXT_TYPE, displayName: text }}
      label={
        <span>
          <Icon type='light-bulb-on' /> Sample queries for <strong>“{text}”</strong>
        </span>
      }
      onClick={select}
    />
  ) : null

  if (!searchValues) {
    const matches = filterTopics(topics, text)
    return (
      <>
        {textSearch}
        <ResultSection title='Topics'>
          {matches.length ? (
            matches.map((topic, i) => <ResultItem key={`topic-${i}-${topic.context}`} item={topic} onClick={select} />)
          ) : (
            <div className='quick-topics-search-empty'>No topics match “{text}”</div>
          )}
        </ResultSection>
      </>
    )
  }

  const isLoading = autocomplete.loading || autocomplete.text !== text

  return (
    <>
      {textSearch}
      <ResultSection title={`Related to “${text}”`}>
        {isLoading ? (
          <div className='quick-topics-search-loading'>
            <LoadingDots />
          </div>
        ) : autocomplete.suggestions.length ? (
          autocomplete.suggestions.map((item, i) => (
            <ResultItem key={`related-${i}-${item.displayName}`} item={item} onClick={select} />
          ))
        ) : (
          <div className='quick-topics-search-empty'>No results</div>
        )}
      </ResultSection>
    </>
  )
}

// After picking a value: the topics that hold it. Picking one opens that topic,
// narrowed to the value.
const TopicsForValue = ({ authentication, topics, item, onTopicSelect }) => {
  const [state, setState] = useState({ loading: true, topics: [], error: undefined })
  const canonical = item.valueLabel?.canonical

  useEffect(() => {
    if (!canonical) {
      setState({ loading: false, topics: [], error: undefined })
      return
    }

    let isCurrent = true
    setState({ loading: true, topics: [], error: undefined })
    fetchSubjectListV2({ ...getAuthentication(authentication), valueLabel: canonical })
      .then((subjects) => {
        if (isCurrent) {
          const matches = (subjects ?? [])
            .map((subject) => topics.find((topic) => topic.context === subject.subject))
            .filter(Boolean)
          setState({ loading: false, topics: matches, error: undefined })
        }
      })
      .catch((error) => {
        console.error(error)
        if (isCurrent) {
          setState({ loading: false, topics: [], error })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [canonical])

  return (
    <ResultSection title={<>Topics with “{item.displayName}”</>}>
      {state.loading ? (
        <div className='quick-topics-search-loading'>
          <LoadingDots />
        </div>
      ) : state.error ? (
        <div className='quick-topics-search-empty'>
          {state.error?.message || 'Something went wrong while finding topics for this value. Please try again.'}
        </div>
      ) : state.topics.length ? (
        state.topics.map((topic, i) => (
          <ResultItem
            key={`value-topic-${i}-${topic.context}`}
            item={topic}
            onClick={() => onTopicSelect(withValueLabel(topic, item.valueLabel))}
          />
        ))
      ) : (
        <div className='quick-topics-search-empty'>No topics hold this value</div>
      )}
    </ResultSection>
  )
}

// After picking the text itself: its spelling/value suggestions if it has any,
// otherwise sample queries for it.
const TextSampleQueries = ({ authentication, item, skipValidation, onSearchText, ...sampleQueryProps }) => {
  const [validation, setValidation] = useState({ loading: !skipValidation, response: undefined })
  const [userSelection, setUserSelection] = useState(item.userSelection)

  useEffect(() => {
    setUserSelection(item.userSelection)
    if (skipValidation) {
      setValidation({ loading: false, response: undefined })
      return
    }

    const source = axios.CancelToken?.source()
    setValidation({ loading: true, response: undefined })
    runQueryValidation({ ...getAuthentication(authentication), text: item.displayName, cancelToken: source?.token })
      .then((response) => {
        setValidation({
          loading: false,
          response: response?.data?.data?.replacements?.length ? response : undefined,
        })
      })
      .catch((error) => {
        if (error?.data?.message !== REQUEST_CANCELLED_ERROR && error?.message !== REQUEST_CANCELLED_ERROR) {
          console.error(error)
          setValidation({ loading: false, response: undefined })
        }
      })

    return () => source?.cancel(REQUEST_CANCELLED_ERROR)
  }, [item.displayName, skipValidation])

  if (validation.loading) {
    return (
      <div className='quick-topics-search-loading'>
        <LoadingDots />
      </div>
    )
  }

  if (validation.response) {
    return (
      <QueryValidationMessage
        response={validation.response}
        onSuggestionClick={({ query, userSelection: picked }) => onSearchText(query, picked)}
        autoSelectSuggestion={true}
        submitText='Search'
        submitIcon='search'
        scope={sampleQueryProps.scope}
      />
    )
  }

  return (
    <SampleQueryList
      authentication={authentication}
      searchText={item.displayName}
      skipQueryValidation={true}
      userSelection={userSelection}
      {...sampleQueryProps}
    />
  )
}

/**
 * The Quick Topics panel while searching. Shows what the search finds; once a value
 * or the text itself is picked (`selection`), shows its topics or sample queries.
 * Picking a topic hands it to onTopicSelect, which opens the usual topic view.
 */
export const TopicSearchPanel = ({
  authentication,
  topics,
  query,
  selection,
  searchValues,
  allowTextSearch,
  onSelect,
  onTopicSelect,
  onSearchText,
  onClose,
  executeQuery,
  tooltipID,
  scope,
  shouldRender,
}) => {
  const scrollbars = useRef()

  let title = 'Search'
  let content
  if (selection?.type === DataExplorerTypes.VL_TYPE) {
    content = (
      <TopicsForValue authentication={authentication} topics={topics} item={selection} onTopicSelect={onTopicSelect} />
    )
  } else if (selection?.type === DataExplorerTypes.TEXT_TYPE) {
    title = (
      <span>
        <Icon type='light-bulb-on' /> Sample queries for “{selection.displayName}”
      </span>
    )
    content = (
      <TextSampleQueries
        key={`${selection.displayName}-${selection.skipValidation ? 'validated' : 'raw'}`}
        authentication={authentication}
        item={selection}
        skipValidation={!!selection.skipValidation}
        onSearchText={onSearchText}
        executeQuery={executeQuery}
        tooltipID={tooltipID}
        scope={scope}
        shouldRender={shouldRender}
        onSuggestionListResponse={() => scrollbars.current?.update?.()}
      />
    )
  } else {
    content = (
      <TopicSearchResults
        authentication={authentication}
        topics={topics}
        query={query}
        searchValues={searchValues}
        allowTextSearch={allowTextSearch}
        onSelect={onSelect}
      />
    )
  }

  return (
    <div className='query-suggestions-expanded quick-topics-search-panel' data-test='quick-topics-search-panel'>
      <div className='query-suggestions-expanded-header'>
        <div className='react-autoql-data-explorer-title-text'>
          <span className='react-autoql-data-explorer-title-text-sample-queries'>{title}</span>
        </div>
        <div className='query-suggestions-expanded-header-actions'>
          <button className='query-suggestions-main-close' onClick={onClose} type='button' aria-label='Close'>
            <Icon type='close' />
          </button>
        </div>
      </div>
      <div className='quick-topics-search-body'>
        <CustomScrollbars ref={scrollbars} autoHide>
          {content}
        </CustomScrollbars>
      </div>
    </div>
  )
}

TopicSearchPanel.propTypes = {
  authentication: authenticationType,
  topics: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  query: PropTypes.string,
  // A value (VL) or the text itself (TEXT) picked from the results
  selection: PropTypes.shape({}),
  // Search values through the Data Explorer autocomplete; off for LLM projects,
  // which only filter the topic list.
  searchValues: PropTypes.bool,
  // Offer sample queries for the typed text itself
  allowTextSearch: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onTopicSelect: PropTypes.func.isRequired,
  onSearchText: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  executeQuery: PropTypes.func,
  tooltipID: PropTypes.string,
  scope: PropTypes.string,
  shouldRender: PropTypes.bool,
}
