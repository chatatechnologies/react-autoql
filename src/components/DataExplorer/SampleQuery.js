import React from 'react'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'
import { SampleQueryReplacementTypes, getSampleQueryText, getTitleCase } from 'autoql-fe-utils'
import { Select } from '../Select'
import { Input } from '../Input'
import { Icon } from '../Icon'
import { VLAutocompleteInput } from '../VLAutocompleteInput'

export default class SampleQuery extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      values: props.suggestion?.initialValues,
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

  getQueryRequestParams = () => {
    const { suggestion } = this.props
    if (!suggestion) {
      return
    }

    const sampleQueryText = getSampleQueryText(suggestion.initialQuery, this.state.values)

    const userSelection = []
    if (Object.keys(this.state.values)?.length) {
      Object.keys(this.state.values)?.forEach((key) => {
        const value = this.state.values[key]
        if (value.type === SampleQueryReplacementTypes.SAMPLE_QUERY_VL_TYPE && value.replacement) {
          userSelection.push(value.replacement)
        }
      })
    }

    return {
      query: sampleQueryText,
      user_selection: userSelection,
    }
  }

  submitQuery = () => {
    const queryRequestParams = this.getQueryRequestParams()
    this.props.executeQuery(queryRequestParams)
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
            const options = [
              { value: chunk.value, label: chunk.value, replacement: chunk.replacement },
              {
                value: 'test-2',
                label: 'test 2',
                replacement: {
                  canonical: 'test',
                  format_txt: 'test 2 format_txt',
                  keyword: 'test 2 keyword',
                  show_message: 'column name',
                },
              },
            ]

            chunkContent = (
              <VLAutocompleteInput
                authentication={this.props.authentication}
                placeholder='Select a Data Value'
                value={this.state.values[chunk.name]?.replacement ?? undefined}
                onChange={(vl) => {
                  const values = {
                    ...this.state.values,
                    [chunk.name]: {
                      ...this.state.values[chunk.name],
                      value: vl.format_txt,
                      replacement: vl,
                    },
                  }
                  this.setState({ values })
                }}
              />
            )

            // chunkContent = (
            //   <Select
            //     size='small'
            //     showArrow={false}
            //     outlined={false}
            //     options={options}
            //     placeholder='Select a Data Value'
            //     value={this.state.values[chunk.name]?.value ?? undefined}
            //     onChange={(value) => {
            //       if (Object.keys(this.state.values).includes(chunk.name)) {
            //         const values = _cloneDeep(this.state.values)
            //         const foundOption = options.find((option) => option.value === value)
            //         if (foundOption && values?.[chunk.name]) {
            //           values[chunk.name].value = foundOption.value
            //           values[chunk.name].replacement = foundOption.replacement
            //         }

            //         this.setState({ values })
            //       }
            //     }}
            //   />
            // )
          } else if (chunk.type == SampleQueryReplacementTypes.SAMPLE_QUERY_AMOUNT_TYPE) {
            // chunkContent = <Input type='number' initialValue={chunk.value} />
            chunkContent = (
              <Select
                size='small'
                showArrow={false}
                outlined={false}
                options={[{ value: chunk.value, label: chunk.value }]}
                value={chunk.value}
              />
            )
          }

          const chunkElement = (
            <div key={`data-explorer-sample-query-chunk-${i}`} className={`data-explorer-sample-chunk ${chunk.type}`}>
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
        >
          <Icon type='send' />
        </div>
      </div>
    )
  }
}
