import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.filter'
import { v4 as uuid } from 'uuid'
import { fetchVLAutocomplete } from 'autoql-fe-utils'

import { Tooltip } from '../Tooltip'
import { Icon } from '../Icon'

import { authenticationDefault, getAuthentication } from '../../props/defaults'
import { authenticationType } from '../../props/types'
import { constructRTArray } from '../../js/reverseTranslationHelpers'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { deepEqual } from '../../js/Util'

import './ReverseTranslation.scss'

export default class ReverseTranslation extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()

    const reverseTranslationArray = constructRTArray(props.queryResponse?.data?.data?.parsed_interpretation)

    this.state = {
      reverseTranslationArray,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    onValueLabelClick: PropTypes.func,
    queryResponse: PropTypes.shape({}),
    tooltipID: PropTypes.string,
    textOnly: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    onValueLabelClick: undefined,
    queryResponse: undefined,
    tooltipID: undefined,
    textOnly: false,
  }

  componentDidMount = () => {
    this._isMounted = true
    if (this.props.onValueLabelClick && this.state.reverseTranslationArray?.length) {
      this.validateAndUpdateValueLabels()
    }
  }

  shouldComponentUpdate = (nextProps) => {
    if (nextProps.isResizing && this.props.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      !deepEqual(
        prevProps.queryResponse?.data?.data?.parsed_interpretation,
        this.props.queryResponse?.data?.data?.parsed_interpretation,
      )
    ) {
      this.setState(
        { reverseTranslationArray: constructRTArray(this.props.queryResponse?.data?.data?.parsed_interpretation) },
        () => {
          this.validateAndUpdateValueLabels()
        },
      )
    }
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  validateAndUpdateValueLabels = () => {
    const sessionFilters = this.props.queryResponse?.data?.data?.fe_req?.persistent_filter_locks ?? []
    const persistentFilters = this.props.queryResponse?.data?.data?.fe_req?.session_filter_locks ?? []
    const lockedFilters = [...persistentFilters, ...sessionFilters] ?? []

    if (this.state.reverseTranslationArray.length) {
      const valueLabelValidationPromises = []
      const validatedInterpretationArray = _cloneDeep(this.state.reverseTranslationArray)
      this.state.reverseTranslationArray.forEach((chunk, i) => {
        if (chunk.c_type === 'VALUE_LABEL') {
          valueLabelValidationPromises.push(
            fetchVLAutocomplete({
              suggestion: chunk.eng,
              ...getAuthentication(this.props.authentication),
            })
              .then((response) => {
                if (response?.data?.data?.matches?.length) {
                  validatedInterpretationArray[i].c_type = 'VALIDATED_VALUE_LABEL'

                  const isLockedFilter = !!lockedFilters.find(
                    (filter) =>
                      filter?.value?.toLowerCase()?.trim() === validatedInterpretationArray[i].eng.toLowerCase().trim(),
                  )

                  if (isLockedFilter) {
                    validatedInterpretationArray[i].isLocked = true
                  }
                }
              })
              .catch((error) => console.error(error)),
          )
        }
      })

      Promise.all(valueLabelValidationPromises).finally(() => {
        if (this._isMounted) {
          this.setState({ reverseTranslationArray: validatedInterpretationArray })
        }
      })
    }
  }

  renderValueLabelLink = (chunk) => {
    return (
      <a
        id='react-autoql-interpreted-value-label'
        className='react-autoql-condition-link-filtered'
        data-test='react-autoql-condition-link'
        onClick={(e) => {
          e.stopPropagation()
          this.props.onValueLabelClick(chunk.eng)
        }}
      >
        {' '}
        {chunk.isLocked && <Icon type='lock' />} {<span>{chunk.eng}</span>}
      </a>
    )
  }

  renderInterpretationChunk = (chunk) => {
    switch (chunk.c_type) {
      case 'VALIDATED_VALUE_LABEL': {
        // If no callback is provided, do not display as link
        if (this.props.onValueLabelClick && !this.props.textOnly) {
          return this.renderValueLabelLink(chunk)
        }
        return ` ${chunk.eng}`
      }
      case 'VALUE_LABEL': {
        // If not VALIDATED_VALUE_LABEL do not display as link
        return ` ${chunk.eng}`
      }
      case 'DELIM': {
        return `${chunk.eng}`
      }
      default: {
        return ` ${chunk.eng}`
      }
    }
  }

  getText = () => {
    let rtString = ''
    this.state.reverseTranslationArray.map((chunk, i) => {
      rtString = `${rtString}${this.renderInterpretationChunk(chunk)}`
    })

    return rtString.trim()
  }

  render = () => {
    if (!this.state.reverseTranslationArray?.length) {
      return null
    }

    return (
      <ErrorBoundary>
        {this.props.textOnly ? (
          <span>{this.getText()}</span>
        ) : (
          <>
            <div
              id={this.COMPONENT_KEY}
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
                    this.props.tooltipID ?? `react-autoql-reverse-translation-tooltip-${this.COMPONENT_KEY}`
                  }
                />
                <strong> Interpreted as: </strong>
                {this.state.reverseTranslationArray.map((chunk, i) => {
                  return <span key={`rt-item-${this.COMPONENT_KEY}-${i}`}>{this.renderInterpretationChunk(chunk)}</span>
                })}
              </div>
            </div>
            {!this.props.tooltipID && (
              <Tooltip
                className='react-autoql-reverse-translation-tooltip'
                id={`react-autoql-reverse-translation-tooltip-${this.COMPONENT_KEY}`}
                place='right'
              />
            )}
          </>
        )}
      </ErrorBoundary>
    )
  }
}
