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
import { Button } from '../Button'

const ReverseTranslation = ({
  authentication = authenticationDefault,
  onValueLabelClick,
  queryResponse,
  tooltipID,
  textOnly = false,
  termId,
  subjects = [],
  queryResponseRef = {},
}) => {
  const COMPONENT_KEY = useRef(uuid())
  const isMounted = useRef(false)
  const initialParsedInterpretations = useRef(queryResponse?.data?.data?.parsed_interpretation)
  const [log, setLog] = useState([])

  const initialReverseTranslationArray = termId && queryResponse?.data?.parsed_interpretations
    ? constructRTArray(queryResponse?.data?.parsed_interpretations[termId])
    : constructRTArray(queryResponse?.data?.data?.parsed_interpretation)

  const [reverseTranslationArray, setReverseTranslationArray] = useState(initialReverseTranslationArray)
  const [refinedReverseTranslationArray, setRefinedReverseTranslationArray] = useState([])
  const [primaryContext, setPrimaryContext] = useState('')
  const [isRefiningRT, setIsRefiningRT] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  console.log('un-fortmatted RT', queryResponse?.data?.data?.parsed_interpretation)
  console.log('formatted RT', reverseTranslationArray)
  console.log('primary context', primaryContext)
  console.log('queryResponseRef', queryResponseRef)

  const findPrimaryContextNameFromRT = useCallback(() => initialReverseTranslationArray?.find((rt) => rt?.c_type === 'SEED')?.clean_causes?.[0] ?? '', [initialReverseTranslationArray])

  const buildValidatedMatch = (match) => {
    return {
      canonical: match?.table_column,
      column_name: match?.table_column,
      format_txt: match?.eng,
      keyword: match?.display_name
    }
  }

  const transformGroupBySuggestions = useCallback(() => {
    if (!primaryContext?.groups?.length) {
      return []
    }
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
    if (!subjects?.length) {
      return []
    }
    for (const context of subjects) {
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
  }, [primaryContext, subjects])

  const validateAndUpdateReverseTranslation = async () => {
    const sessionFilters = queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const persistentFilters = queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []

    if (reverseTranslationArray?.length) {

      console.log('contexts', subjects)

      const validatedInterpretationArray = _cloneDeep(reverseTranslationArray)

      const primaryContextName = findPrimaryContextNameFromRT()
      console.log('primary context name', primaryContextName)
      const context = subjects?.find((subject) => subject?.context === primaryContextName) || {}

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
            const group = context?.groups?.find(group => group.table_column === groupByColumnName) || {}

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
            const filter = context?.filters?.find(filter => filter?.display_name?.toLowerCase()?.trim() === filterName) || {}

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
        console.log('validatedInterpretationArray', validatedInterpretationArray)
        console.log('context', context)
        setPrimaryContext(context)
        setReverseTranslationArray([...validatedInterpretationArray])
      }
    }
  }

  function removeBrackets(str) {
    return str.replace(/[\[\]{}()]/g, '');
  }

  const getText = () => {
    let rtString = ''
    reverseTranslationArray.forEach((chunk) => {
      rtString = `${rtString} ${removeBrackets(chunk?.eng) || chunk}`
    })
    return rtString.trim()
  }

  if (!reverseTranslationArray?.length) {
    return null
  }

  const queryNewRT = () => {
    const query = getText()
    console.log('reverseTranslationArray', reverseTranslationArray)
    console.log('query', query)
    queryResponseRef?.queryFn({ query: query }).then((response) => {
      if (response?.data?.data?.rows) {
        queryResponseRef?.updateColumnsAndData(response)
      } else {
        throw new Error('New column addition failed')
      }
    })
      .catch((error) => {
        console.error(error)
        this.tableRef?.setPageLoading(false)
      })
  }

  useEffect(() => {
    const executePrerequisites = async () => {
      setIsLoading(true)
      try {
        console.log('1')
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
    const newParsedInterpretation = queryResponse?.data?.data?.parsed_interpretation
    console.log('newParsedInterpretation', newParsedInterpretation)
    console.log('initialParsedInterpretations', initialParsedInterpretations)
    if (!deepEqual(newParsedInterpretation, initialParsedInterpretations?.current)) {
      const newArray = constructRTArray(newParsedInterpretation)
      setReverseTranslationArray(newArray)
      validateAndUpdateReverseTranslation()
    }
  }, [queryResponse?.data?.data?.parsed_interpretation])

  useEffect(() => {
    if (reverseTranslationArray?.length && log?.length) {
      queryNewRT()
    }
  }, [log])

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
    console.log('filter', filter)
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
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
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
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
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
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
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
                <div style={{ display: 'inline-block', marginRight: '3px' }}>
                  {renderInterpretationChunk(chunk, i)}
                </div>
              ))}
            </div>
            {/* <div>
              <Button onClick={() => queryNewRT()}>
                click me
              </Button>
            </div> */}
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
  subjects: PropTypes.arrayOf(PropTypes.shape({})),
  queryResponseRef: PropTypes.shape({}),
}

export default ReverseTranslation