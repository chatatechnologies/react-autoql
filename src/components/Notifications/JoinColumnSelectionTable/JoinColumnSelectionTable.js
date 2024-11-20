import React from 'react'
import PropTypes from 'prop-types'
import './JoinColumnSelectionTable.scss'
import { Select } from '../../Select'
import { Icon } from '../../Icon'
import { getQuerySelectableJoinColumns, getDefaultJoinColumns } from 'autoql-fe-utils'

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
    isReadOnly: PropTypes.bool,
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
    isReadOnly: false,
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
    const { firstJoinColumns, secondJoinColumns } = getDefaultJoinColumns(
      this.props.firstQueryResult,
      this.props.secondQueryResult,
    )
    const isEditingDataAlert = this.props.storedInitialData?.[0]?.join_columns?.[0] !== undefined
    const hasStoredFirstQuerySecondValue = this.props.storedInitialData?.[0]?.join_columns?.[1] !== undefined
    const hasStoredSecondQuerySecondValue = this.props.storedInitialData?.[1]?.join_columns?.[1] !== undefined
    this.props.onFirstQueryFirstValueChange(
      this.state.firstQueryFirstValue !== '' ? this.state.firstQueryFirstValue : firstJoinColumns?.[0],
    )
    this.props.onSecondQueryFirstValueChange(
      this.state.secondQueryFirstValue !== '' ? this.state.secondQueryFirstValue : firstJoinColumns?.[1],
    )
    if (this.state.firstQuerySecondValue || secondJoinColumns?.[0]) {
      if (isEditingDataAlert && !hasStoredFirstQuerySecondValue) {
        return
      }
      this.props.onFirstQuerySecondValueChange(
        this.state.firstQuerySecondValue !== '' ? this.state.firstQuerySecondValue : secondJoinColumns?.[0],
      )
      this.setState({ showSecondRow: true })
    }

    if (this.state.secondQuerySecondValue || secondJoinColumns?.[1]) {
      if (isEditingDataAlert && !hasStoredSecondQuerySecondValue) {
        return
      }
      this.props.onSecondQuerySecondValueChange(
        this.state.secondQuerySecondValue !== '' ? this.state.secondQuerySecondValue : secondJoinColumns?.[1],
      )
      this.setState({ showSecondRow: true })
    }
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
              {!this.state.showSecondRow && selectableJoinColumnsLength > 1 && !this.props.isReadOnly && (
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
              isDisabled={this.props.isReadOnly}
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
              isDisabled={this.props.isReadOnly}
            />
          </td>
        </tr>
        {this.state.showSecondRow && (
          <tr>
            <th>
              <div className='th-content'>
                {this.props.rowHeaders[1]}
                {!this.props.isReadOnly && (
                  <div className='remove-second-join-icon' onClick={this.handleRemoveSecondRow}>
                    <Icon type='minus' />
                  </div>
                )}
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
                isDisabled={this.props.isReadOnly}
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
                isDisabled={this.props.isReadOnly}
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
        <div className='join-columns-notice'>
          Please review the join columns below and adjust if necessary to ensure correct relationships between your
          datasets.
        </div>
        <table className='joinable-table'>
          <thead>{this.renderHeaderRow()}</thead>
          <tbody>{this.renderBodyRows()}</tbody>
        </table>
      </div>
    )
  }
}
