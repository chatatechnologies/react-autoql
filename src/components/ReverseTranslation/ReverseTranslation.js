import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.filter'
import { v4 as uuid } from 'uuid'

import { Icon } from '../Icon'

import { authenticationType, themeConfigType } from '../../props/types'
import {
  themeConfigDefault,
  getThemeConfig,
  authenticationDefault,
  getAuthentication,
} from '../../props/defaults'

import { fetchVLAutocomplete } from '../../js/queryService'
import { setCSSVars } from '../../js/Util'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './ReverseTranslation.scss'

export default class ReverseTranslation extends React.Component {
  constructor(props) {
    super(props)

    this.COMPONENT_KEY = uuid()
    this.reverseTranslationArray = props.reverseTranslation

    this.state = {
      isValidated: false,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    themeConfig: themeConfigType,
    interpretation: PropTypes.array,
    onValueLabelClick: PropTypes.func,
    appliedFilters: PropTypes.array,
    reverseTranslation: PropTypes.array,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    themeConfig: themeConfigDefault,
    interpretation: [],
    appliedFilters: [],
    reverseTranslation: [],
    onValueLabelClick: undefined,
  }

  componentDidMount = () => {
    setCSSVars(getThemeConfig(this.props.themeConfig))
    if (this.props.onValueLabelClick) {
      this.validateAndUpdateValueLabels()
    }
  }

  shouldComponentUpdate = (nextProps) => {
    if (this.props.isResizing && nextProps.isResizing) {
      return false
    }

    return true
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      !_isEqual(
        getThemeConfig(this.props.themeConfig),
        getThemeConfig(prevProps.themeConfig)
      )
    ) {
      setCSSVars(getThemeConfig(this.props.themeConfig))
    }
  }

  validateAndUpdateValueLabels = () => {
    if (this.reverseTranslationArray.length) {
      const valueLabelValidationPromises = []
      const validatedInterpretationArray = _cloneDeep(
        this.reverseTranslationArray
      )
      this.reverseTranslationArray.forEach((chunk, i) => {
        if (chunk.c_type === 'VALUE_LABEL') {
          valueLabelValidationPromises.push(
            fetchVLAutocomplete({
              suggestion: chunk.eng,
              ...getAuthentication(this.props.authentication),
            }).then((response) => {
              if (_get(response, 'data.data.matches.length')) {
                validatedInterpretationArray[i].c_type = 'VALIDATED_VALUE_LABEL'
              }
            })
          )
        }
      })

      Promise.all(valueLabelValidationPromises).then(() => {
        this.reverseTranslationArray = validatedInterpretationArray
        this.setState({ isValidated: true })
      })
    }
  }

  renderFilterLockLink = (text) => {
    return (
      <a
        id="react-autoql-interpreted-value-label"
        className="react-autoql-condition-link-filtered"
        data-test="react-autoql-condition-link"
        onClick={(e) => {
          e.stopPropagation()
          this.props.onValueLabelClick(text)
        }}
      >
        {' '}
        {this.props.appliedFilters.includes(text) && <Icon type="lock" />}{' '}
        {<span>{text}</span>}
      </a>
    )
  }

  renderInterpretationChunk = (chunk) => {
    switch (chunk.c_type) {
      case 'VALIDATED_VALUE_LABEL': {
        // If no callback is provided, do not display as link
        if (this.props.onValueLabelClick) {
          return this.renderFilterLockLink(chunk.eng)
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

  render = () => {
    if (!_get(this.reverseTranslationArray, 'length')) {
      return null
    }

    return (
      <ErrorBoundary>
        <div
          id={this.COMPONENT_KEY}
          className="react-autoql-reverse-translation-container"
          data-test="react-autoql-reverse-translation-container"
        >
          <div className="react-autoql-reverse-translation">
            <Icon type="info" />
            <strong> Interpreted as: </strong>
            {this.reverseTranslationArray.map((chunk, i) => {
              return (
                <span key={`rt-item-${this.COMPONENT_KEY}-${i}`}>
                  {this.renderInterpretationChunk(chunk)}
                </span>
              )
            })}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
}
