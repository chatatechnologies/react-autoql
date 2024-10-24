import React from 'react'
import PropTypes from 'prop-types'
import './JoinColumnSelectionTable.scss'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { getQuerySelectableJoinColumns, getDefaultJoinColumnAndDisplayNameAndJoinColumnsIndices } from 'autoql-fe-utils'
export default class JoinColumnSelectionTable extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      showSecondRow: false,
      selectableJoinColumnsLength: this.getSelectableJoinColumnsLength(),
      firstQueryFirstValue: props.storedInitialData?.[0]?.join_columns?.[0] || props.firstQueryFirstValue,
      firstQuerySecondValue: props.storedInitialData?.[0]?.join_columns?.[1] || props.firstQuerySecondValue,
      secondQueryFirstValue: props.storedInitialData?.[1]?.join_columns?.[0] || props.secondQueryFirstValue,
      secondQuerySecondValue: props.storedInitialData?.[1]?.join_columns?.[1] || props.secondQuerySecondValue,
    }
  }

  static propTypes = {
    storedInitialData: PropTypes.arrayOf(
      PropTypes.shape({
        join_columns: PropTypes.arrayOf(PropTypes.string),
      }),
    ),
    columnHeaders: PropTypes.arrayOf(PropTypes.string),
    rowHeaders: PropTypes.arrayOf(PropTypes.string),
    firstQueryResult: PropTypes.shape({}),
    secondQueryResult: PropTypes.shape({}),
    firstQueryFirstValue: PropTypes.string,
    firstQuerySecondValue: PropTypes.string,
    secondQueryFirstValue: PropTypes.string,
    secondQuerySecondValue: PropTypes.string,
    onFirstQueryFirstValueChange: PropTypes.func,
    onFirstQuerySecondValueChange: PropTypes.func,
    onSecondQueryFirstValueChange: PropTypes.func,
    onSecondQuerySecondValueChange: PropTypes.func,
    onRemoveSecondValues: PropTypes.func,
  }

  static defaultProps = {
    storedInitialData: [],
    columnHeaders: [],
    rowHeaders: [],
    firstQueryResult: null,
    secondQueryResult: null,
    firstQueryFirstValue: '',
    firstQuerySecondValue: '',
    secondQueryFirstValue: '',
    secondQuerySecondValue: '',
    onFirstQueryFirstValueChange: () => {},
    onFirstQuerySecondValueChange: () => {},
    onSecondQueryFirstValueChange: () => {},
    onSecondQuerySecondValueChange: () => {},
    onRemoveSecondValues: () => {},
    firstQueryFirstOptions: [],
    firstQuerySecondOptions: [],
    secondQueryFirstOptions: [],
    secondQuerySecondOptions: [],
  }
  componentDidMount() {
    const firstDefaultJoinColumn =
      this.state.firstQueryFirstValue || this.getDefaultJoinColumn(this.props.firstQueryResult)
    const secondDefaultJoinColumn =
      this.state.secondQueryFirstValue || this.getDefaultJoinColumn(this.props.secondQueryResult)
    this.props.onFirstQueryFirstValueChange(firstDefaultJoinColumn)
    this.props.onSecondQueryFirstValueChange(secondDefaultJoinColumn)
    if (this.state.firstQuerySecondValue) {
      this.props.onFirstQuerySecondValueChange(this.state.firstQuerySecondValue)
      this.setState({ showSecondRow: true })
    }

    if (this.state.secondQuerySecondValue) {
      this.props.onSecondQuerySecondValueChange(this.state.secondQuerySecondValue)
      this.setState({ showSecondRow: true })
    }
  }

  getDefaultJoinColumn = (queryResult) => {
    const { defaultJoinColumn } = getDefaultJoinColumnAndDisplayNameAndJoinColumnsIndices(queryResult)
    return defaultJoinColumn?.[0]
  }

  getSelectableJoinColumnsLength() {
    try {
      const firstQueryColumns = this.props.firstQueryResult?.data?.data?.columns || []
      const secondQueryColumns = this.props.secondQueryResult?.data?.data?.columns || []
      const firstSelectableColumns = getQuerySelectableJoinColumns(firstQueryColumns)
      const secondSelectableColumns = getQuerySelectableJoinColumns(secondQueryColumns)

      return Math.min(firstSelectableColumns.length, secondSelectableColumns.length)
    } catch (error) {
      console.error('Error calculating selectable join columns length:', error)
      return 0
    }
  }

  handleRemoveSecondRow = () => {
    this.setState({ showSecondRow: false })
    this.props.onRemoveSecondValues()
  }

  renderHeaderRow = () => {
    return (
      <tr>
        <th></th>
        {this.props.columnHeaders.map((header, index) => (
          <th key={`col-${index}`}>
            <div className='header-content'>{header}</div>
          </th>
        ))}
      </tr>
    )
  }

  renderBodyRows = () => {
    const selectableJoinColumnsLength =
      this.state.selectableJoinColumnsLength === 0
        ? this.getSelectableJoinColumnsLength()
        : this.state.selectableJoinColumnsLength
    return (
      <>
        <tr>
          <th>
            <div className='th-content'>
              {this.props.rowHeaders[0]}
              {!this.state.showSecondRow && selectableJoinColumnsLength > 1 && (
                <div className='add-second-join-icon' onClick={() => this.setState({ showSecondRow: true })}>
                  <Icon type='plus' />
                </div>
              )}
            </div>
          </th>
          <td>
            <Select
              outlined={false}
              showArrow={false}
              options={this.props.firstQueryFirstOptions}
              placeholder='Select column from first query'
              value={this.props.firstQueryFirstValue}
              onChange={this.props.onFirstQueryFirstValueChange}
            />
          </td>
          <td>
            <Select
              outlined={false}
              showArrow={false}
              options={this.props.secondQueryFirstOptions}
              value={this.props.secondQueryFirstValue}
              onChange={this.props.onSecondQueryFirstValueChange}
              placeholder='Select column from second query'
            />
          </td>
        </tr>
        {this.state.showSecondRow && (
          <tr>
            <th>
              <div className='th-content'>
                {this.props.rowHeaders[1]}
                <div className='remove-second-join-icon' onClick={this.handleRemoveSecondRow}>
                  <Icon type='minus' />
                </div>
              </div>
            </th>
            <td>
              <Select
                outlined={false}
                showArrow={false}
                options={this.props.firstQuerySecondOptions}
                placeholder='Select column from first query'
                value={this.props.firstQuerySecondValue}
                onChange={this.props.onFirstQuerySecondValueChange}
              />
            </td>
            <td>
              <Select
                outlined={false}
                showArrow={false}
                options={this.props.secondQuerySecondOptions}
                value={this.props.secondQuerySecondValue}
                onChange={this.props.onSecondQuerySecondValueChange}
                placeholder='Select column from second query'
              />
            </td>
          </tr>
        )}
      </>
    )
  }

  render() {
    return (
      <div className='join-column-selection-container'>
        <table className='joinable-table'>
          <thead>{this.renderHeaderRow()}</thead>
          <tbody>{this.renderBodyRows()}</tbody>
        </table>
      </div>
    )
  }
}
