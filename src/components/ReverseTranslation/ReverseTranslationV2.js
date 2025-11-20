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
  titlelizeString,
  normalizeString,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { authenticationType } from '../../props/types'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import VLAutocompleteInputV2 from '../VLAutocompleteInput/VLAutocompleteInputV2'
import GroupByAutocompleteInput from '../VLAutocompleteInput/GroupByAutocompleteInput'
import ContextAutocompleteInput from '../VLAutocompleteInput/ContextAutocompleteInput'
import InlineInputEditor from '../DataExplorer/InlineInputEditor'
import { Spinner } from '../Spinner'
import { AddColumnBtn } from '../AddColumnBtn'
import { Popover } from '../Popover'
import AggMenu from '../AddColumnBtn/AggMenu'

import './ReverseTranslation.scss'

const ReverseTranslation = ({
  authentication = authenticationDefault,
  onValueLabelClick,
  queryResponse,
  tooltipID,
  textOnly = false,
  termId,
  subjects = [],
  queryResponseRef = {},
  allowColumnAddition = false,
  enableEditReverseTranslation = false,
  localRTFilterResponse,
}) => {
  const COMPONENT_KEY = useRef(uuid())
  const isMounted = useRef(false)
  const initialParsedInterpretations = useRef()
  const validatedParsedInterpretations = useRef(null)
  const [log, setLog] = useState([])

  const initialReverseTranslationArray =
    termId && queryResponse?.data?.parsed_interpretations
      ? constructRTArray(queryResponse?.data?.parsed_interpretations[termId])
      : constructRTArray(queryResponse?.data?.data?.parsed_interpretation)

  const [reverseTranslationArray, setReverseTranslationArray] = useState(initialReverseTranslationArray)
  const [primaryContext, setPrimaryContext] = useState('')
  const [isRefiningRT, setIsRefiningRT] = useState(false)
  const [aggPopoverActiveID, setAggPopoverActiveID] = useState(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const findPrimaryContextNameFromRT = useCallback(
    () => initialReverseTranslationArray?.find((rt) => rt?.c_type === 'SEED')?.clean_causes?.[0] ?? '',
    [initialReverseTranslationArray],
  )

  const buildValidatedMatch = (match) => {
    return {
      canonical: match?.table_column,
      column_name: match?.table_column,
      format_txt: match?.eng,
      keyword: match?.display_name,
    }
  }

  const transformGroupBySuggestions = useCallback(() => {
    if (!primaryContext?.groups?.length) {
      return []
    }
    return primaryContext?.groups.map((group) => ({
      value: group.table_column,
      label: `by ${group.display_name}`,
      description: primaryContext?.context,
      canonical: group.table_column,
      originalMatch: group,
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

      const contextFilters = context?.filters?.map((filter) => {
        return {
          value: filter?.table_column,
          label: filter?.display_name,
          description: context?.displayName,
          canonical: filter?.table_column,
          originalMatch: { ...filter, subject: context?.context },
        }
      })

      if (contextFilters?.length > 0) {
        transformedSuggestions.push(...contextFilters)
      }
    }
    return transformedSuggestions
  }, [primaryContext, subjects])

  const validateAndUpdateReverseTranslation = async (rt) => {
    const sessionFilters = queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const persistentFilters = queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []
    let contextChunk = null
    let contextChunkIndex = null

    let cancelled = false

    if (rt?.length) {
      const validatedInterpretationArray = _cloneDeep(rt)

      const primaryContextName = findPrimaryContextNameFromRT()
      const context = subjects?.find((subject) => subject?.context === primaryContextName) || {}

      const valueLabelValidationPromises = rt.map(async (chunk, i) => {
        if (cancelled) return
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
                (filter) =>
                  normalizeString(filter?.value) === normalizeString(validatedInterpretationArray[i].eng) || // session filter returns an object with value
                  normalizeString(filter) === normalizeString(validatedInterpretationArray[i].eng), // persistent filter returns a string in an array
              )

              if (isLockedFilter) {
                validatedInterpretationArray[i].isLocked = true
              }
            }
          } catch (error) {
            console.error(error)
          }
        } else if (enableEditReverseTranslation && chunk.c_type === 'GROUPBY') {
          try {
            const groupByColumnName = chunk.clean_causes?.[0] ?? ''
            const group = context?.groups?.find((group) => group.table_column === groupByColumnName) || {}

            if (group?.table_column) {
              validatedInterpretationArray[i].c_type = 'VALIDATED_GROUP_BY'
              validatedInterpretationArray[i].match = buildValidatedMatch({ ...group, eng: chunk?.eng })
            }
          } catch (error) {
            console.error(error)
          }
        } else if (enableEditReverseTranslation && chunk.c_type === 'SEED') {
          try {
            const filterName = chunk?.eng?.toLowerCase()?.trim() ?? ''
            const filter =
              context?.filters?.find((filter) => filter?.display_name?.toLowerCase()?.trim() === filterName) || {}

            if (filter?.display_name) {
              validatedInterpretationArray[i].c_type = 'VALIDATED_SEED'
              validatedInterpretationArray[i].match = buildValidatedMatch({ ...filter, eng: chunk?.eng })
              contextChunk = {
                c_type: 'SEED_SUFFIX',
                eng: ` (${titlelizeString(context?.displayName)})`,
                for: filter?.display_name,
              }
              contextChunkIndex = i + 1
            }
          } catch (error) {
            console.error(error)
          }
        }
      })

      await Promise.all(valueLabelValidationPromises)

      if (contextChunkIndex && contextChunk) {
        validatedInterpretationArray.splice(contextChunkIndex, 0, contextChunk)
      }

      if (isMounted.current) {
        validatedParsedInterpretations.current = [...validatedInterpretationArray]
        initialParsedInterpretations.current = queryResponse?.data?.data?.parsed_interpretation
        setPrimaryContext(context)
        setReverseTranslationArray([...validatedInterpretationArray])
      }
    }

    return () => {
      cancelled = true
    }
  }

  function removeBracketsAndParenthesesAndCharacterBetween(str) {
    return str.replace(/\[[^\]]*\]|\{[^}]*\}|\([^\)]*\)/g, '')
  }

  const getText = () => {
    let rtString = ''
    reverseTranslationArray.forEach((chunk) => {
      rtString = `${rtString} ${removeBracketsAndParenthesesAndCharacterBetween(chunk?.eng)}`
    })
    return rtString.trim()
  }

  const resetReverseTranslation = () => {
    setReverseTranslationArray(validatedParsedInterpretations?.current)
    setIsRefiningRT(false)
  }

  const queryNewRT = () => {
    const query = getText()
    setIsLoading(true)
    queryResponseRef?.tableRef?.setPageLoading(true)
    queryResponseRef
      ?.queryFn({ query: query })
      .then((response) => {
        if (response?.data?.data?.rows) {
          queryResponseRef?.updateColumnsAndData(response)
        } else {
          throw new Error('New column addition failed')
        }
        setIsRefiningRT(false)
        setIsLoading(false)
        queryResponseRef?.tableRef?.setPageLoading(false)
      })
      .catch((error) => {
        console.error(error)
        setIsRefiningRT(false)
        setIsLoading(false)
        this.queryResponseRef?.setPageLoading(false)
      })
  }

  const executePrerequisites = async (rt) => {
    setIsLoading(true)
    try {
      await validateAndUpdateReverseTranslation(rt)
    } catch (error) {
      console.error('Prerequisites not met to render Reverse Translation')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    isMounted.current = true

    let cancelled = false

    if (onValueLabelClick && reverseTranslationArray?.length) {
      executePrerequisites(reverseTranslationArray)
    } else {
      console.error('Prerequisites not met to render Reverse Translation')
    }

    return () => {
      isMounted.current = false
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const newParsedInterpretation = queryResponse?.data?.data?.parsed_interpretation
    initialParsedInterpretations.current = newParsedInterpretation
    const newArray = constructRTArray(newParsedInterpretation)
    executePrerequisites(newArray)
  }, [queryResponse?.data?.data?.parsed_interpretation])

  // todo: see if we can update and remove this useEffect and use queryRepsonse instead
  useEffect(() => {
    const newParsedInterpretation = localRTFilterResponse?.data?.data?.parsed_interpretation
    initialParsedInterpretations.current = newParsedInterpretation
    const newArray = constructRTArray(newParsedInterpretation)
    executePrerequisites(newArray)
  }, [localRTFilterResponse?.data?.data?.parsed_interpretation])

  useEffect(() => {
    if (isRefiningRT && primaryContext && reverseTranslationArray?.length) {
      queryNewRT()
    }
  }, [primaryContext])

  const renderValueLabelLink = (chunk, disableAction) => {
    return (
      <a
        id='react-autoql-interpreted-value-label'
        className='react-autoql-condition-link-filtered'
        data-test='react-autoql-condition-link'
        onClick={(e) => {
          e.stopPropagation()
          if (disableAction) return
          onValueLabelClick(chunk.eng)
        }}
      >
        {' '}
        {chunk.isLocked && <Icon type='lock' />} {<span>{chunk.eng}</span>}
      </a>
    )
  }

  const renderSeedHighlight = (chunk) => {
    return (
      <a
        id='react-autoql-interpreted-value-label'
        className='react-autoql-condition-link-filtered'
        style={{ cursor: 'default' }}
        data-test='react-autoql-condition-link'
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {<span>{chunk.eng}</span>}
      </a>
    )
  }

  const handleFilterChange = (filter, existingIndex) => {
    setLog([...log, filter])
    setReverseTranslationArray((prevRefinedReverseTranslationArray) => {
      if (existingIndex !== -1) {
        if (filter?.c_type === 'VALIDATED_SEED' && filter?.match?.show_message !== primaryContext?.displayName) {
          prevRefinedReverseTranslationArray.splice(existingIndex + 1)
          return [...prevRefinedReverseTranslationArray.map((f, i) => (i === existingIndex ? filter : f))]
        }
        return [...prevRefinedReverseTranslationArray.map((f, i) => (i === existingIndex ? filter : f))]
      } else {
        return [...prevRefinedReverseTranslationArray, filter]
      }
    })
  }

  const renderAddColumnBtn = (key, disableGroupColumnsOptions = false, disableFilterColumnsOptions = false) => {
    if (!allowColumnAddition) {
      return null
    }
    return (
      <AddColumnBtn
        key={key}
        id={key}
        queryResponse={queryResponse}
        columns={queryResponseRef?.state.columns}
        tooltipID={tooltipID}
        onAddColumnClick={queryResponseRef?.onAddColumnClick}
        enableInlineStyle={true}
        disableGroupColumnsOptions={disableGroupColumnsOptions}
        disableFilterColumnsOptions={disableFilterColumnsOptions}
        allowCustom={false}
      />
    )
  }

  const renderValueLabelChunk = (chunk, i) => {
    return (
      <VLAutocompleteInputV2
        authentication={authentication}
        column='Player'
        context={primaryContext}
        value={chunk?.match}
        onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
        filters={log}
        onToast={true}
        placeholder='Choose a VL...'
      />
    )
  }

  const renderSeedChunk = (chunk, i) => {
    return (
      <>
        <ContextAutocompleteInput
          value={chunk?.match}
          onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
          suggestions={transformFilterSuggestions()}
          primaryContext={primaryContext}
          filters={log}
          onToast={true}
        />
        {renderAddColumnBtn(`${COMPONENT_KEY}-seed-chunk-add-column-button`, true, false)}
      </>
    )
  }

  const renderGroupByChunk = (chunk, i) => {
    return (
      <>
        <GroupByAutocompleteInput
          value={chunk?.match}
          onChange={(newValue) => handleFilterChange({ ...chunk, match: newValue, eng: newValue?.format_txt }, i)}
          suggestions={transformGroupBySuggestions()}
          filters={log}
          onToast={true}
          placeholder='Choose a GROUP BY...'
        />
        {renderAddColumnBtn(`${COMPONENT_KEY}-groupby-chunk-add-column-button`, false, true)}
      </>
    )
  }

  const renderAggMenu = (chunk, i) => {
    return (
      <Popover
        key={`agg-select-menu-${i}`}
        isOpen={aggPopoverActiveID === `column-select-menu-item-${i}`}
        onClickOutside={() => setAggPopoverActiveID(undefined)}
        content={() => (
          <AggMenu
            handleAggMenuItemClick={(aggType) => {
              handleFilterChange({ ...chunk, eng: aggType?.displayName }, i)
              setAggPopoverActiveID(undefined)
            }}
          />
        )}
        positions={['right', 'left']}
        align='start'
        padding={0}
      >
        <div>
          <InlineInputEditor
            value={chunk?.eng}
            type='text'
            disabledOnClickEdit={true}
            onClickEdit={() => setAggPopoverActiveID(`column-select-menu-item-${i}`)}
            tooltipID={tooltipID}
          />
        </div>
      </Popover>
    )
  }

  const renderInlineTextChunk = (chunk, i) => {
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
        return renderSeedHighlight(chunk)
      }
      case 'SEED': {
        return ` ${titlelizeString(chunk.eng)}`
      }
      case 'VALIDATED_GROUP_BY': {
        if (isRefiningRT) {
          return renderGroupByChunk(chunk, i)
        }
        return ` ${chunk.eng}`
      }
      case 'GROUP_BY': {
        return ` ${titlelizeString(chunk.eng)}`
      }
      case 'PREFIX': {
        if (isRefiningRT) {
          return renderAggMenu(chunk, i)
        }
        return ` ${titlelizeString(chunk.eng)}`
      }
      case 'DATE':
      case 'TEXT':
      case 'FILTER': {
        if (isRefiningRT) {
          return renderInlineTextChunk(chunk, i)
        }
        return ` ${chunk.eng}`
      }
      default: {
        return ` ${chunk.eng}`
      }
    }
  }

  const renderActionIcon = () => {
    if (isLoading) {
      return <Spinner data-test='react-autoql-btn-loading' />
    }
    if (isRefiningRT) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon
            type='play'
            onClick={() => queryNewRT()}
            data-tooltip-content={'Execute query interpretation to update the data response.'}
            data-tooltip-id={tooltipID ?? `react-autoql-update-reverse-translation-tooltip-${COMPONENT_KEY.current}`}
          />
          <Icon
            type='close-circle'
            danger={true}
            onClick={() => resetReverseTranslation()}
            data-tooltip-content={'Reset query interpretation to the original query.'}
            data-tooltip-id={tooltipID ?? `react-autoql-reset-reverse-translation-tooltip-${COMPONENT_KEY.current}`}
          />
        </div>
      )
    }
    return (
      <Icon
        type='edit'
        onClick={() => setIsRefiningRT(!isRefiningRT)}
        data-tooltip-content={'Edit query interpretation to update the data response.'}
        data-tooltip-id={tooltipID ?? `react-autoql-edit-reverse-translation-tooltip-${COMPONENT_KEY.current}`}
      />
    )
  }

  const hasInterpretationArray = !!reverseTranslationArray?.length
  const hasTextInterpretation = !!queryResponse?.data?.data?.interpretation

  if (!hasInterpretationArray && !hasTextInterpretation) {
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
                data-tooltip-id={tooltipID ?? `react-autoql-reverse-translation-tooltip-${COMPONENT_KEY.current}`}
              />
              <strong> Interpreted as: </strong>
              {hasInterpretationArray ? (
                <>
                  {reverseTranslationArray.map((chunk, i) => (
                    <div className='react-autoql-reverse-translation-chunk' key={i}>
                      {renderInterpretationChunk(chunk, i)}
                    </div>
                  ))}
                  <div className={`react-autoql-reverse-translation-action-button${isRefiningRT ? ' active' : ''}`}>
                    {enableEditReverseTranslation ? renderActionIcon() : null}
                  </div>
                </>
              ) : (
                <div>{queryResponse?.data?.data?.interpretation}</div>
              )}
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
  subjects: PropTypes.arrayOf(PropTypes.shape({})),
  queryResponseRef: PropTypes.shape({}),
  allowColumnAddition: PropTypes.bool,
  localRTFilterResponse: PropTypes.shape({}),
}

export default ReverseTranslation
