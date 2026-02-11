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

    const initialValues = props.suggestion?.initialValues ? _cloneDeep(props.suggestion?.initialValues) : {}

    if (props.initialValues && Object.keys(props.initialValues)?.length) {
      const initialValuesFromProps = _cloneDeep(props.initialValues)
      Object.keys(initialValuesFromProps).forEach((key) => {
        initialValues[key] = initialValuesFromProps[key]
      })
    }

    // Removing this for now. After some testing, this can be removed
    // It is used to populate all initial values with the selected VL in the search bar
    // But it might not be necessary if recommendation always sends back this default VL based on the column filter
    // if (props.valueLabel && initialValues) {
    //   Object.keys(initialValues).forEach((key) => {
    //     if (!initialValues[key]?.type === SampleQueryReplacementTypes.SAMPLE_QUERY_VL_TYPE) {
    //       return
    //     }
    //     const valueLabelColumn = props.valueLabel?.column_name
    //     const replacementColumn = initialValues[key]?.replacement?.column_name
    //     if (valueLabelColumn && replacementColumn && valueLabelColumn === replacementColumn) {
    //       initialValues[key].replacement = props.valueLabel
    //       initialValues[key].value = props.valueLabel?.format_txt
    //     }
    //   })
    // }

    this.state = {
      values: initialValues,
    }
  }

  static propTypes = {
    initialValues: PropTypes.shape({}),
    suggestion: PropTypes.shape({}),
    onVLChange: PropTypes.func,
    executeQuery: PropTypes.func,
  }

  static defaultProps = {
    initialValues: undefined,
    suggestion: undefined,
    onVLChange: () => {},
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
    this.props.executeQuery({ ...queryRequestParams })
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
    this.props.onVLChange(values)
  }

  render = () => {
    const { suggestion } = this.props

    if (!suggestion) {
      return null
    }

    const renderedChunks = []
    if (suggestion.chunked?.length) {
      suggestion.chunked.forEach((chunk, i) => {
        if (chunk?.value) {
          let text = <span>&#20;{chunk.value}</span>
          if (i === 0 && chunk?.type === SampleQueryReplacementTypes.SAMPLE_QUERY_TEXT_TYPE) {
            text = <span>{getTitleCase(chunk.value)}</span>
          }

          let chunkContent = text

          if (chunk.type === SampleQueryReplacementTypes.SAMPLE_QUERY_VL_TYPE) {
            const columnName = chunk.replacement?.display_name

            let vlAutocompleteValue
            if (this.state.values[chunk.name]?.replacement) {
              vlAutocompleteValue = {
                ...this.state.values[chunk.name]?.replacement,
              }
            }

            chunkContent = (
              <VLAutocompleteInputPopover
                authentication={this.props.authentication}
                value={this.state.values[chunk.name]?.replacement ?? undefined}
                onChange={(newValue) => this.onValueChange(newValue, chunk.name)}
                tooltipID={this.props.tooltipID}
                context={this.props.context}
                column={columnName}
                shouldRender={this.props.shouldRender}
                placeholder={columnName ? `Search a "${columnName}"` : 'Search values'}
              />
            )
          } else if (chunk.type === SampleQueryReplacementTypes.SAMPLE_QUERY_AMOUNT_TYPE) {
            chunkContent = (
              <InlineInputEditor
                value={chunk.value}
                type='number'
                onChange={(newValue) => this.onAmountChange(newValue, chunk.name)}
                tooltipID={this.props.tooltipID}
              />
            )
          } else if (chunk.type === SampleQueryReplacementTypes.SAMPLE_QUERY_TIME_TYPE) {
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
        <Icon type='lightning' /> <div className='query-suggestion-text'>{renderedChunks}</div>
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
