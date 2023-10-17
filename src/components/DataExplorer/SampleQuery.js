import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { SampleQueryReplacementTypes, getQueryRequestParams, getTitleCase } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import InlineInputEditor from './InlineInputEditor'
import { VLAutocompleteInputPopover } from '../VLAutocompleteInput'

export default class SampleQuery extends React.Component {
  constructor(props) {
    super(props)

    const initialValues = _cloneDeep(props.suggestion?.initialValues)

    if (props.valueLabel && initialValues) {
      Object.keys(initialValues).forEach((key) => {
        if (initialValues[key]?.type === SampleQueryReplacementTypes.SAMPLE_QUERY_VL_TYPE) {
          initialValues[key].replacement = props.valueLabel
          initialValues[key].value = props.valueLabel?.format_txt
        }
      })
    }

    this.state = {
      values: initialValues,
    }
  }

  static propTypes = {
    suggestion: PropTypes.shape({}),
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    suggestion: undefined,
    executeQuery: () => {},
  }

  componentDidMount = () => {
    this._isMounted = true
  }

  componentWillUnmount = () => {
    this._isMounted = false
  }

  submitQuery = () => {
    const queryRequestParams = getQueryRequestParams(this.props.suggestion, this.state.values)
    this.props.executeQuery(queryRequestParams)
  }

  onAmountChange = (rawValue, chunkName) => {
    if (!this.state.values?.[chunkName] || rawValue === undefined) {
      return
    }

    let value = rawValue
    if (value === '') {
      value = this.props.suggestion?.initialValues?.[chunkName]?.replacement?.format_txt
    }

    const values = {
      ...(this.state.values ?? {}),
      [chunkName]: {
        ...this.state.values[chunkName],
        value,
        replacement: {
          ...this.state.values[chunkName].replacement,
          format_txt: value,
        },
      },
    }

    this.setState({ values })
  }

  onValueChange = (vl, chunkName) => {
    if (!this.state.values?.[chunkName] || !vl?.format_txt) {
      return
    }

    const values = {
      ...(this.state.values ?? {}),
      [chunkName]: {
        ...this.state.values[chunkName],
        value: vl.format_txt,
        replacement: vl,
      },
    }
    this.setState({ values })
  }

  render = () => {
    const { suggestion } = this.props

    if (!suggestion) {
      return null
    }

    let renderedChunks = []
    if (suggestion.chunked?.length) {
      suggestion.chunked.forEach((chunk, i) => {
        if (chunk?.value) {
          let text = <span>&#20;{chunk.value}</span>
          if (i === 0 && chunk?.type == SampleQueryReplacementTypes.SAMPLE_QUERY_TEXT_TYPE) {
            text = <span>{getTitleCase(chunk.value)}</span>
          }

          let chunkContent = text

          if (chunk.type == SampleQueryReplacementTypes.SAMPLE_QUERY_VL_TYPE) {
            chunkContent = (
              <VLAutocompleteInputPopover
                authentication={this.props.authentication}
                placeholder='Search values'
                value={this.state.values[chunk.name]?.replacement ?? undefined}
                onChange={(newValue) => this.onValueChange(newValue, chunk.name)}
                tooltipID={this.props.tooltipID}
                context={this.props.context}
                shouldRender={this.props.shouldRender}
              />
            )
          } else if (chunk.type == SampleQueryReplacementTypes.SAMPLE_QUERY_AMOUNT_TYPE) {
            chunkContent = (
              <InlineInputEditor
                value={chunk.value}
                type='number'
                onChange={(newValue) => this.onAmountChange(newValue, chunk.name)}
                tooltipID={this.props.tooltipID}
              />
            )
          } else if (chunk.type == SampleQueryReplacementTypes.SAMPLE_QUERY_TIME_TYPE) {
            chunkContent = (
              <InlineInputEditor
                value={chunk.value}
                type='text'
                onChange={(newValue) => this.onAmountChange(newValue, chunk.name)}
                datePicker={true}
                tooltipID={this.props.tooltipID}
              />
            )
          }

          const chunkElement = (
            <div
              key={`data-explorer-sample-query-chunk-${i}`}
              className={`data-explorer-sample-chunk data-explorer-sample-chunk-${chunk.type}`}
            >
              {chunkContent}
            </div>
          )

          renderedChunks.push(chunkElement)
        }
      })
    }

    return (
      <div className='data-explorer-sample-query'>
        <div className='query-suggestion-text'>{renderedChunks}</div>
        <div
          className='query-suggestion-send-btn'
          onClick={this.submitQuery}
          data-tooltip-content='Submit Query'
          data-tooltip-id={this.props.tooltipID}
          data-tooltip-delay-show={800}
        >
          <Icon type='send' />
        </div>
      </div>
    )
  }
}
