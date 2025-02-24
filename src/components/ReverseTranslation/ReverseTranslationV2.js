import React, { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.filter'

import {
  deepEqual,
  constructRTArray,
  getAuthentication,
  fetchVLAutocomplete,
  authenticationDefault,
  fetchSubjectList,
  ColumnTypes,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { authenticationType } from '../../props/types'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './ReverseTranslation.scss'
import VLAutocompleteInputV2 from '../VLAutocompleteInput/VLAutocompleteInputV2'
import GroupByAutocompleteInput from '../VLAutocompleteInput/GroupByAutocompleteInput'
import ContextAutocompleteInput from '../VLAutocompleteInput/ContextAutocompleteInput'
import InlineInputEditor from '../DataExplorer/InlineInputEditor'

const ReverseTranslation = ({
  authentication = authenticationDefault,
  onValueLabelClick,
  queryResponse,
  tooltipID,
  textOnly = false,
  termId,
  filterResponse,
}) => {
  const COMPONENT_KEY = useRef(uuid())
  const isMounted = useRef(false)
  const [log, setLog] = useState([])

  const initialReverseTranslationArray = termId && queryResponse?.data?.parsed_interpretations
    ? constructRTArray(queryResponse?.data?.parsed_interpretations[termId])
    : constructRTArray(queryResponse?.data?.data?.parsed_interpretation)

  const [reverseTranslationArray, setReverseTranslationArray] = useState(initialReverseTranslationArray)
  const [refinedReverseTranslationArray, setRefinedReverseTranslationArray] = useState([])
  const [primaryContext, setPrimaryContext] = useState('player stats')
  const [contexts, setContexts] = useState([])
  const [isRefiningRT, setIsRefiningRT] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  console.log('un-fortmatted RT', queryResponse?.data?.data?.parsed_interpretation)
  console.log('formatted RT', reverseTranslationArray)

  const findPrimaryContextNameFromRT = () => reverseTranslationArray?.find((rt) => rt?.c_type === 'SEED')?.clean_causes?.[0] ?? ''

  const buildValidatedMatch = (match) => {
    return {
      canonical: match?.table_column,
      column_name: match?.table_column,
      format_txt: match?.eng,
      keyword: match?.display_name
    }
  }

  const transformGroupBySuggestions = useCallback(() => {
    return primaryContext?.groups.map(group => ({
      value: group.table_column,
      label: `by ${group.display_name}`,
      description: primaryContext?.context,
      canonical: group.table_column,
      originalMatch: group
    }))
  }, [primaryContext])

  const transformFilterSuggestions = useCallback(() => {
    const transformedSuggestions = []
    for (const context of contexts) {
      if (context?.filters?.length === 0) {
        continue
      }

      const contextFilters = context?.filters?.map(filter => {
        return ({
          value: filter?.table_column,
          label: filter?.display_name,
          description: context?.displayName,
          canonical: filter?.table_column,
          originalMatch: { ...filter, subject: context?.context },
        })
      })

      if (contextFilters?.length > 0) {
        transformedSuggestions.push(...contextFilters)
      }
    }
    return transformedSuggestions
  }, [primaryContext, contexts])

  const fetchAndSetSubjectsGroupBysAndFilters = async () => {
    try {
      const primaryContextName = findPrimaryContextNameFromRT()

      const subjects = await fetchSubjectList({
        ...getAuthentication(authentication),
      })

      const context = subjects?.find((subject) => subject?.context === primaryContextName) || {}

      setContexts(subjects)
      setPrimaryContext(context)

      return Promise.resolve()
    } catch (error) {
      console.error(error)
      return Promise.resolve()
    }
  }

  const validateAndUpdateReverseTranslation = async () => {
    const sessionFilters = queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const persistentFilters = queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []

    if (reverseTranslationArray?.length) {
      const validatedInterpretationArray = _cloneDeep(reverseTranslationArray)

      const valueLabelValidationPromises = reverseTranslationArray.map(async (chunk, i) => {
        if (chunk.c_type === 'VALUE_LABEL') {
          try {
            const response = await fetchVLAutocomplete({
              suggestion: chunk.eng,
              ...getAuthentication(authentication),
            })

            if (response?.data?.data?.matches?.length) {
              validatedInterpretationArray[i].c_type = 'VALIDATED_VALUE_LABEL'
              validatedInterpretationArray[i].match = response.data.data.matches?.[0]

              const isLockedFilter = !!lockedFilters.find(
                (filter) => filter?.value?.toLowerCase()?.trim() === validatedInterpretationArray[i].eng.toLowerCase().trim()
              )

              if (isLockedFilter) {
                validatedInterpretationArray[i].isLocked = true
              }
            }
          } catch (error) {
            console.error(error)
          }
        } else if (chunk.c_type === 'GROUPBY') {
          try {
            const groupByColumnName = chunk.clean_causes?.[0] ?? ''
            const group = primaryContext?.groups.find(group => group.table_column === groupByColumnName) || {}

            if (group?.table_column) {
              validatedInterpretationArray[i].c_type = 'VALIDATED_GROUP_BY'
              validatedInterpretationArray[i].match = buildValidatedMatch({ ...group, eng: chunk?.eng })
            }

          } catch (error) {
            console.error(error)
          }
        } else if (chunk.c_type === 'SEED') {
          try {
            const filterName = chunk?.eng?.toLowerCase()?.trim() ?? ''
            const filter = primaryContext?.filters?.find(filter => filter?.display_name?.toLowerCase()?.trim() === filterName) || {}

            if (filter?.display_name) {
              validatedInterpretationArray[i].c_type = 'VALIDATED_SEED'
              validatedInterpretationArray[i].match = buildValidatedMatch({ ...filter, eng: chunk?.eng })
            }

          } catch (error) {
            console.error(error)
          }
        }
      })

      await Promise.all(valueLabelValidationPromises)

      if (isMounted.current) {
        setReverseTranslationArray([...validatedInterpretationArray])
      }
    }
  }

  useEffect(() => {
    const executePrerequisites = async () => {
      setIsLoading(true)
      try {
        await fetchAndSetSubjectsGroupBysAndFilters()
        await validateAndUpdateReverseTranslation()
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    isMounted.current = true

    if (onValueLabelClick && reverseTranslationArray?.length) {
      executePrerequisites()
    } else {
      console.error('Prerequisites not met to render Reverse Translation')
    }

    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (filterResponse) {
      const newArray = constructRTArray(filterResponse?.data?.data?.parsed_interpretation)
      setReverseTranslationArray(newArray)
      validateAndUpdateReverseTranslation()
    }
  }, [filterResponse])

  useEffect(() => {
    const newParsedInterpretation = queryResponse?.data?.data?.parsed_interpretation
    const currentParsedInterpretation = reverseTranslationArray

    if (!deepEqual(currentParsedInterpretation, newParsedInterpretation)) {
      const newArray = constructRTArray(newParsedInterpretation)
      setReverseTranslationArray(newArray)
      validateAndUpdateReverseTranslation()
    }
  }, [queryResponse?.data?.data?.parsed_interpretation])

  const renderValueLabelLink = (chunk) => {
    return (
      <a
        id='react-autoql-interpreted-value-label'
        className='react-autoql-condition-link-filtered'
        data-test='react-autoql-condition-link'
        onClick={(e) => {
          e.stopPropagation()
          onValueLabelClick(chunk.eng)
        }}
      >
        {' '}
        {chunk.isLocked && <Icon type='lock' />} {<span>{chunk.eng}</span>}
      </a>
    )
  }

  const handleFilterChange = (filter, existingIndex) => {
    setLog([...log, filter])
    setReverseTranslationArray((prevRefinedReverseTranslationArray) => { // should be refined reverse translation
      if (existingIndex !== -1) {
        return prevRefinedReverseTranslationArray.map((f, i) => (i === existingIndex ? filter : f))
      } else {
        return [...prevRefinedReverseTranslationArray, filter]
      }
    })
  }

  const renderValueLabelChunk = (chunk, i) => { // all three of these AutoComplete inputs could be put into one
    return (
      <VLAutocompleteInputV2
        authentication={authentication}
        column="Player"
        context={primaryContext}
        value={chunk?.match}
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue }, i)}
        filters={log}
        onToast={true}
        placeholder="Choose a VL..."
      />
    )
  }

  const renderSeedChunk = (chunk, i) => {
    return (
      <ContextAutocompleteInput
        value={chunk?.match}
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue }, i)}
        suggestions={transformFilterSuggestions()}
        primaryContext={primaryContext}
        filters={log}
        onToast={true}
      />
    )
  }

  const renderGroupByChunk = (chunk, i) => {
    return (
      <GroupByAutocompleteInput
        value={chunk?.match}
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue }, i)}
        suggestions={transformGroupBySuggestions()}
        filters={log}
        onToast={true}
        placeholder="Choose a GROUP BY..."
      />
    )
  }

  const renderFilterChunk = (chunk, i) => {
    return (
      <InlineInputEditor
        value={chunk?.eng}
        type='text'
        onChange={(newValue) => handleFilterChange({ ...chunk, eng: newValue }, i)}
        datePicker={chunk?.c_type === ColumnTypes.DATE}
        tooltipID={tooltipID}
      />
    )
  }

  const renderInterpretationChunk = (chunk, i = -1) => {
    switch (chunk.c_type) {
      case 'VALIDATED_VALUE_LABEL': {
        if (isRefiningRT) {
          return renderValueLabelChunk(chunk, i)
        }
        if (onValueLabelClick && !textOnly) {
          return renderValueLabelLink(chunk)
        }
        return ` ${chunk.eng}`
      }
      case 'VALIDATED_SEED': {
        if (isRefiningRT) {
          return renderSeedChunk(chunk, i)
        }
        return ` ${chunk.eng}`
      }
      case 'VALIDATED_GROUP_BY': {
        if (isRefiningRT) {
          return renderGroupByChunk(chunk, i)
        }
        return ` ${chunk.eng}`
      }
      case 'PREFIX':
      case 'DATE':
      case 'TEXT':
      case 'FILTER': {
        if (isRefiningRT) {
          return renderFilterChunk(chunk, i)
        }
        return ` ${chunk.eng}`
      }
      default: {
        return ` ${chunk.eng}`
      }
    }
  }

  const getText = () => {
    let rtString = ''
    reverseTranslationArray.forEach((chunk, i) => {
      rtString = `${rtString}${renderInterpretationChunk(chunk, i)}`
    })
    return rtString.trim()
  }

  if (!reverseTranslationArray?.length) {
    return null
  }

  return (
    <ErrorBoundary>
      {textOnly ? (
        <span>{getText()}</span>
      ) : (
        <>
          <div
            id={COMPONENT_KEY.current}
            className='react-autoql-reverse-translation-container'
            data-test='react-autoql-reverse-translation-container'
          >
            <div className='react-autoql-reverse-translation'>
              <Icon
                type='info'
                data-tooltip-content={
                  'This statement reflects how your query was interpreted in order to return this data response.'
                }
                data-tooltip-id={
                  tooltipID ?? `react-autoql-reverse-translation-tooltip-${COMPONENT_KEY.current}`
                }
              />
              <strong> Interpreted as: </strong>
              {isLoading ? '...' : reverseTranslationArray.map((chunk, i) => (
                <span key={`rt-item-${COMPONENT_KEY.current}-${i}`}>
                  {renderInterpretationChunk(chunk, i)}
                </span>
              ))}
            </div>
          </div>
          {!tooltipID && (
            <Tooltip
              className='react-autoql-reverse-translation-tooltip'
              tooltipId={`react-autoql-reverse-translation-tooltip-${COMPONENT_KEY.current}`}
              place='right'
            />
          )}
        </>
      )}
    </ErrorBoundary>
  )
}

ReverseTranslation.propTypes = {
  authentication: authenticationType,
  onValueLabelClick: PropTypes.func,
  queryResponse: PropTypes.shape({}),
  tooltipID: PropTypes.string,
  textOnly: PropTypes.bool,
  termId: PropTypes.string,
  filterResponse: PropTypes.shape({}),
}

export default ReverseTranslation