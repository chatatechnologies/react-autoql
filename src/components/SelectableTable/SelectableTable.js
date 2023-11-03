import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _isEqual from 'lodash.isequal'
import _cloneDeep from 'lodash.clonedeep'

import { formatElement, getDataFormatting, dataFormattingDefault, COLUMN_TYPES } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import { Checkbox } from '../Checkbox'
import { CustomScrollbars } from '../CustomScrollbars'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import { dataFormattingType } from '../../props/types'

import './SelectableTable.scss'

export default class SelectableTable extends React.Component {
  constructor(props) {
    super(props)

    this.ID = uuid()
  }

  static propTypes = {
    dataFormatting: dataFormattingType,
    shouldRender: PropTypes.bool,
    queryResponse: PropTypes.shape({}),
    onColumnSelection: PropTypes.func,
    selectedColumns: PropTypes.arrayOf(PropTypes.number),
    disabledColumns: PropTypes.arrayOf(PropTypes.number),
    radio: PropTypes.bool,
    showEndOfPreviewMessage: PropTypes.bool,
    showTooltips: PropTypes.bool,
  }

  static defaultProps = {
    dataFormatting: dataFormattingDefault,
    shouldRender: true,
    queryResponse: null,
    onColumnSelection: () => {},
    selectedColumns: [],
    disabledColumns: [],
    radio: false,
    showEndOfPreviewMessage: true,
    showTooltips: true,
  }

  componentDidMount = () => {
    setTimeout(() => {
      this.scrollbars?.update()
    }, 2000)
  }

  formatColumnHeader = (column, i) => {
    return (
      <div
        className='selectable-table-col-header'
        data-tooltip-id={`selectable-table-column-header-tooltip-${this.ID}`}
        data-tooltip-content={this.props.showTooltips ? JSON.stringify(column) : null}
      >
        <span>{column?.display_name}</span>
        <Checkbox
          disabled={this.props.disabledColumns.includes(i)}
          checked={this.props.selectedColumns?.includes(i)}
          onChange={() => this.onColumnHeaderClick(i)}
        />
      </div>
    )
  }

  formatCell = ({ cell, column, config }) => {
    return (
      <div
        className='selectable-table-cell'
        style={{
          textAlign: column.type === 'DOLLAR_AMT' ? 'right' : 'center',
        }}
      >
        {formatElement({
          element: cell,
          column,
          config,
        })}
      </div>
    )
  }

  onColumnHeaderClick = (index) => {
    if (this.props.disabledColumns.includes(index)) {
      return
    }

    if (this.props.radio) {
      this.props.onColumnSelection?.([index])
    } else {
      let selectedColumns = _cloneDeep(this.props.selectedColumns)

      if (selectedColumns?.includes(index)) {
        selectedColumns = selectedColumns.filter((i) => i !== index)
      } else {
        selectedColumns.push(index)
      }

      this.props.onColumnSelection?.(selectedColumns)
    }
  }

  onMouseOverColumn = (e, columnIndex) => {
    // Must use vanilla styling to achieve hover styles for a whole column
    const allColumnHeaders = this.tableRef?.querySelectorAll('.selectable-table-column')
    allColumnHeaders?.forEach((header) => {
      header.classList.remove('react-autoql-selectable-table-hovered')
    })

    const allCells = this.tableRef?.querySelectorAll('.selectable-table-cell')
    allCells?.forEach((cell) => {
      cell.classList.remove('react-autoql-selectable-table-hovered')
    })

    if (this.props.disabledColumns.includes(columnIndex)) {
      return
    }

    const columnHeader = this.tableRef?.querySelector(`#col-header-${columnIndex}`)
    columnHeader?.classList.add('react-autoql-selectable-table-hovered')

    const cells = this.tableRef?.querySelectorAll(`.cell-${columnIndex}`)
    cells?.forEach((cell) => cell.classList.add('react-autoql-selectable-table-hovered'))
  }

  renderTableCaption = () => {
    if (!this.props.queryResponse?.data?.data?.columns) {
      return null
    }

    return (
      <div className='react-autoql-selectable-table-header'>
        <span className='react-autoql-selectable-table-selected-columns-text'>{this.props.caption}</span>
      </div>
    )
  }

  renderHeaderTooltipContent = ({ content }) => {
    let column
    try {
      column = JSON.parse(content)
    } catch (error) {
      return null
    }

    if (!column) {
      return null
    }

    const name = column.display_name
    const type = COLUMN_TYPES[column.type]?.description
    const icon = COLUMN_TYPES[column.type]?.icon

    return (
      <div>
        <div className='selectable-table-tooltip-title'>
          <span>{name}</span>
        </div>
        {!!type && (
          <div className='selectable-table-tooltip-section'>
            {!!icon && <Icon type={icon} />}
            <span>{type}</span>
          </div>
        )}
      </div>
    )
  }

  render = () => {
    if (!this.props.shouldRender) {
      return null
    }

    const rows = this.props.queryResponse?.data?.data?.rows
    const columns = this.props.queryResponse?.data?.data?.columns
    const config = getDataFormatting(this.props.dataFormatting)

    return (
      <ErrorBoundary>
        <div ref={(r) => (this.tableRef = r)} className='react-autoql-selectable-table'>
          <div className='react-autoql-selectable-table-wrapper'>
            <CustomScrollbars autoHide={true} ref={(r) => (this.scrollbars = r)}>
              <table>
                <thead>
                  <tr>
                    {columns.map((col, i) => {
                      const isDisabled = this.props.disabledColumns.includes(i)

                      return (
                        <th
                          id={`col-header-${i}`}
                          key={`col-header-${i}`}
                          className={`selectable-table-column${
                            this.props.selectedColumns.includes(i)
                              ? ' selectable-table-column-selected'
                              : ' selectable-table-column-unselected'
                          }${isDisabled ? ' selectable-table-column-disabled' : ''}`}
                          onClick={() => this.onColumnHeaderClick(i)}
                          onMouseOver={(e) => this.onMouseOverColumn(e, i)}
                        >
                          {this.formatColumnHeader(col, i)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    return (
                      <tr key={`row-${i}`} className='selectable-table-row'>
                        {row.map((cell, j) => {
                          const column = columns[j]
                          const isDisabled = this.props.disabledColumns.includes(j)
                          return (
                            <td
                              className={`selectable-table-cell ${
                                this.props.selectedColumns.includes(j)
                                  ? 'selectable-table-cell-selected'
                                  : 'selectable-table-cell-unselected'
                              } cell-${j}${isDisabled ? ' selectable-table-cell-disabled' : ''}`}
                              onClick={() => this.onColumnHeaderClick(j)}
                              onMouseOver={(e) => this.onMouseOverColumn(e, j)}
                              key={`cell-${j}`}
                            >
                              {this.formatCell({ cell, column, config })}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {!!this.props.showEndOfPreviewMessage && (
                    <tr className='selectable-table-end-of-preview-message'>
                      <td className='selectable-table-end-of-preview-sticky-wrapper' colSpan={`${columns.length}`}>
                        End of Preview
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CustomScrollbars>
          </div>
          {!!this.props.caption && this.renderTableCaption()}
        </div>
        <Tooltip
          tooltipId={`selectable-table-column-header-tooltip-${this.ID}`}
          className='selectable-table-column-header-tooltip'
          render={this.renderHeaderTooltipContent}
          opacity={1}
          border
        />
      </ErrorBoundary>
    )
  }
}
