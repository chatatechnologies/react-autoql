import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import PropTypes from 'prop-types'
import {
  DataExplorerTypes,
  REQUEST_CANCELLED_ERROR,
  fetchDataExplorerAutocomplete,
  fetchSubjectListV2,
  getAuthentication,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Select } from '../Select'
import { LoadingDots } from '../LoadingDots'
import FieldSelector from '../FieldSelector'
import { CustomScrollbars } from '../CustomScrollbars'
import DataPreview from '../DataExplorer/DataPreview'
import { SubjectName } from '../DataExplorer/SubjectName'
import SampleQueryList from '../DataExplorer/SampleQueryList'
import { getSampleQueryColumns } from '../../js/sampleQueryColumns'
import { addRecentTopicSearch, clearRecentTopicSearches, getRecentTopicSearches } from '../../js/topicSearchHistory'
import { authenticationType, dataFormattingType } from '../../props/types'

const AUTOCOMPLETE_DELAY_MS = 200

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

const ResultItem = ({ item, onClick }) => (
  <button type='button' className='quick-topics-search-result' onClick={() => onClick(item)}>
    <SubjectName subject={item} />
  </button>
)

const Loading = () => (
  <div className='quick-topics-search-loading'>
    <LoadingDots />
  </div>
)

// What the search finds, as the Data Explorer's input did: recent searches and every
// topic before anything is typed, then the topics and values (VLs) the autocomplete
// relates to the text. Nothing runs until one is picked. `resultsRef.current` is kept
// pointing at the first result, for Enter in the search field.
const TopicSearchResults = ({ authentication, topics, query, onSelect, resultsRef }) => {
  const [recentSearches, setRecentSearches] = useState(() => getRecentTopicSearches(authentication))
  const [autocomplete, setAutocomplete] = useState({ text: undefined, suggestions: [], loading: false })
  const text = query?.trim()

  useEffect(() => {
    if (!text) {
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
  }, [text])

  const isLoading = !!text && (autocomplete.loading || autocomplete.text !== text)
  const results = text ? (isLoading ? [] : autocomplete.suggestions) : topics

  useEffect(() => {
    if (resultsRef) {
      // Nothing typed, nothing for Enter to pick: the list is just every topic
      resultsRef.current = { firstResult: text ? results[0] : undefined }
    }
  })

  const select = (item) => {
    setRecentSearches(addRecentTopicSearch(authentication, item))
    onSelect(item)
  }

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

  return (
    <ResultSection title={`Related to “${text}”`}>
      {isLoading ? (
        <Loading />
      ) : results.length ? (
        results.map((item, i) => <ResultItem key={`related-${i}-${item.displayName}`} item={item} onClick={select} />)
      ) : (
        <div className='quick-topics-search-empty'>No results</div>
      )}
    </ResultSection>
  )
}

/**
 * A topic picked from the search: its data preview and, when the project has them,
 * its sample queries, on two tabs. Fields picked in either (columns in the preview,
 * or the field selector) narrow the sample queries, with example values from the
 * preview - as in the Data Explorer.
 */
export const TopicExplorer = ({
  authentication,
  dataFormatting,
  topic,
  value,
  showSampleQueries,
  executeQuery,
  tooltipID,
  scope,
  shouldRender,
}) => {
  const [activeTab, setActiveTab] = useState('preview')
  const [dataPreview, setDataPreview] = useState()
  const [selectedColumns, setSelectedColumns] = useState([])

  const sampleQueryColumns = getSampleQueryColumns({
    dataPreview,
    selectedColumns,
    valueLabel: value?.valueLabel,
    dataFormatting,
  })

  return (
    <div className='quick-topics-explorer' data-test='quick-topics-explorer'>
      {showSampleQueries && (
        <div className='quick-topics-tabs' role='tablist'>
          {[
            ['preview', 'Data preview'],
            ['queries', 'Sample queries'],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type='button'
              role='tab'
              aria-selected={activeTab === tab}
              className={`quick-topics-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {/* Both tabs stay mounted: the preview's data feeds the sample queries' field
          picker and example values, so it loads whichever tab is open. */}
      <div className='query-suggestions-data-preview' hidden={activeTab !== 'preview'}>
        <DataPreview
          authentication={authentication}
          dataFormatting={dataFormatting}
          subject={topic}
          shouldRender={shouldRender}
          tooltipID={tooltipID}
          selectable={showSampleQueries}
          disableColumnSelection={!showSampleQueries}
          selectedColumns={selectedColumns}
          onColumnSelection={setSelectedColumns}
          onDataPreview={setDataPreview}
        />
      </div>
      {showSampleQueries && (
        <div className='quick-topics-sample-queries' hidden={activeTab !== 'queries'}>
          <div className='quick-topics-sample-queries-header'>
            <FieldSelector
              columns={dataPreview?.data?.data?.columns}
              selectedColumns={selectedColumns}
              onColumnsChange={setSelectedColumns}
              selectedSubject={value ?? topic}
              selectedTopic={value ? topic : null}
              loading={!dataPreview}
            />
          </div>
          <div className='query-suggestions-sample-list'>
            <SampleQueryList
              authentication={authentication}
              columns={sampleQueryColumns}
              context={topic.context}
              valueLabel={value?.valueLabel}
              searchText=''
              executeQuery={executeQuery}
              skipQueryValidation={false}
              userSelection={null}
              tooltipID={tooltipID}
              scope={scope}
              shouldRender={shouldRender}
              onSuggestionListResponse={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  )
}

TopicExplorer.propTypes = {
  authentication: authenticationType,
  dataFormatting: dataFormattingType,
  topic: PropTypes.shape({ context: PropTypes.string }).isRequired,
  // A value (VL) the topic was found through; narrows the sample queries to it
  value: PropTypes.shape({ valueLabel: PropTypes.shape({}) }),
  showSampleQueries: PropTypes.bool,
  executeQuery: PropTypes.func,
  tooltipID: PropTypes.string,
  scope: PropTypes.string,
  shouldRender: PropTypes.bool,
}

// A value (VL) picked from the search: the topics (contexts) that hold it, to pick
// one from - the first by default - and that topic's preview and sample queries.
const ValueExplorer = ({ authentication, topics, value, ...explorerProps }) => {
  const [contexts, setContexts] = useState({ loading: true, topics: [], error: undefined })
  const [selectedContext, setSelectedContext] = useState()
  const canonical = value.valueLabel?.canonical

  useEffect(() => {
    if (!canonical) {
      setContexts({ loading: false, topics: [], error: undefined })
      return
    }

    let isCurrent = true
    setContexts({ loading: true, topics: [], error: undefined })
    fetchSubjectListV2({ ...getAuthentication(authentication), valueLabel: canonical })
      .then((subjects) => {
        if (isCurrent) {
          const matches = (subjects ?? [])
            .map((subject) => topics.find((topic) => topic.context === subject.subject))
            .filter(Boolean)
          setContexts({ loading: false, topics: matches, error: undefined })
          setSelectedContext(matches[0]?.context)
        }
      })
      .catch((error) => {
        console.error(error)
        if (isCurrent) {
          setContexts({ loading: false, topics: [], error })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [canonical])

  if (contexts.loading) {
    return <Loading />
  }

  if (contexts.error || !contexts.topics.length) {
    return (
      <div className='quick-topics-search-empty'>
        {contexts.error
          ? contexts.error?.message || 'Something went wrong while finding topics for this value. Please try again.'
          : 'No topics hold this value'}
      </div>
    )
  }

  const topic = contexts.topics.find((t) => t.context === selectedContext) ?? contexts.topics[0]

  return (
    <>
      <div className='quick-topics-value-context'>
        <span>Topic:</span>
        <Select
          size='small'
          value={topic.context}
          options={contexts.topics.map((t) => ({ value: t.context, label: t.displayName }))}
          onChange={setSelectedContext}
        />
      </div>
      <TopicExplorer
        key={topic.context}
        authentication={authentication}
        topic={topic}
        value={value}
        {...explorerProps}
      />
    </>
  )
}

/**
 * The Quick Topics panel while searching: what the search finds, then the topic or
 * value picked from it (`selection`), with a back button to the results.
 */
export const TopicSearchPanel = ({
  authentication,
  dataFormatting,
  topics,
  query,
  selection,
  showSampleQueries,
  onSelect,
  onBack,
  onClose,
  resultsRef,
  executeQuery,
  tooltipID,
  scope,
  shouldRender,
}) => {
  const scrollbars = useRef()
  const explorerProps = { dataFormatting, showSampleQueries, executeQuery, tooltipID, scope, shouldRender }

  let content
  if (selection?.type === DataExplorerTypes.VL_TYPE) {
    content = (
      <ValueExplorer
        key={selection.displayName}
        authentication={authentication}
        topics={topics}
        value={selection}
        {...explorerProps}
      />
    )
  } else if (selection) {
    content = (
      <TopicExplorer key={selection.context} authentication={authentication} topic={selection} {...explorerProps} />
    )
  }

  return (
    <div
      className={`query-suggestions-expanded quick-topics-search-panel${selection ? ' has-selection' : ''}`}
      data-test='quick-topics-search-panel'
    >
      <div className='query-suggestions-expanded-header'>
        <div className='react-autoql-data-explorer-title-text'>
          {selection ? (
            <button type='button' className='quick-topics-search-back' onClick={onBack} aria-label='Back to results'>
              <Icon type='caret-left' />
              <SubjectName subject={selection} />
            </button>
          ) : (
            <span className='react-autoql-data-explorer-title-text-sample-queries'>Search</span>
          )}
        </div>
        <div className='query-suggestions-expanded-header-actions'>
          <button className='query-suggestions-main-close' onClick={onClose} type='button' aria-label='Close'>
            <Icon type='close' />
          </button>
        </div>
      </div>
      <div className='quick-topics-search-body'>
        {content ?? (
          <CustomScrollbars ref={scrollbars} autoHide>
            <TopicSearchResults
              authentication={authentication}
              topics={topics}
              query={query}
              onSelect={onSelect}
              resultsRef={resultsRef}
            />
          </CustomScrollbars>
        )}
      </div>
    </div>
  )
}

TopicSearchPanel.propTypes = {
  authentication: authenticationType,
  dataFormatting: dataFormattingType,
  topics: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  query: PropTypes.string,
  // The topic (SUBJECT) or value (VL) picked from the results
  selection: PropTypes.shape({}),
  showSampleQueries: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  resultsRef: PropTypes.shape({ current: PropTypes.any }),
  executeQuery: PropTypes.func,
  tooltipID: PropTypes.string,
  scope: PropTypes.string,
  shouldRender: PropTypes.bool,
}
