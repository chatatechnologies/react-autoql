import React from 'react'
import { v4 as uuid } from 'uuid'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import {
  authenticationDefault,
  autoQLConfigDefault,
  dataFormattingDefault,
  deepEqual,
  getVisibleColumns,
} from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { Input } from '../Input'
import { Button } from '../Button'
import { Select } from '../Select'
import ChataTable from './ChataTable'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

import './CustomColumnModal.scss'

export default class CustomColumnModal extends React.Component {
  constructor(props) {
    super(props)

    this.TABLE_ID = uuid()

    const columnName = 'New Column'

    const firstIndex = props.columns.findIndex((col) => col.is_visible)

    const initialColumnFn = [
      {
        type: 'column',
        value: props.columns[firstIndex].field,
        column: props.columns[firstIndex],
      },
    ]

    this.newColumn = {
      ...initialColumnFn[0].column,
      title: columnName,
      display_name: columnName,
      field: `${props.columns?.length}`,
      custom: true,
      fnSummary: `= ${initialColumnFn[0].column?.display_name}`,
      mutator: this.getFnMutator(initialColumnFn),
    }

    this.state = {
      columns: [...props.columns, this.newColumn],
      columnName,
      columnFn: initialColumnFn,
    }
  }

  static propTypes = {
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    onConfirm: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    onConfirm: () => {},
    onClose: () => {},
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.columnName && this.state.columnName !== prevState.columnName) {
      const name = this.state.columnName
      this.newColumn.display_name = name
      this.newColumn.title = name

      // Debounce change since column update is expensive
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.tableRef?.ref?.updateColumn?.(this.newColumn.field, this.newColumn)
      }, 500)
    }

    // Update column mutator is function changed
    if (!deepEqual(this.state.columnFn, prevState.columnFn)) {
      setTimeout(() => {
        this.updateTabulatorColumnFn()
      }, 0)
    }

    // Update header tooltips if column changed
    if (!deepEqual(this.state.columns, prevState.columns)) {
      this.tableRef?.setHeaderInputEventListeners(this.state.columns)
    }
  }

  getFnMutator = (columnFn) => {
    return (value, data, type, params, component) => {
      //value - original value of the cell
      //data - the data for the row
      //type - the type of mutation occurring  (data|edit)
      //params - the mutatorParams object from the column definition
      //component - when the "type" argument is "edit", this contains the cell component for the edited cell, otherwise it is the column component for the column
      return data[columnFn[0].column?.index] //return the sum of the other two columns.
    }
  }

  getFnSummary = (columnFn) => {
    return `= ${columnFn[0].column?.display_name}`
  }

  updateTabulatorColumnFn = () => {
    const columns = _cloneDeep(this.state.columns)
    const newParams = {
      mutator: this.getFnMutator(this.state.columnFn),
      fnSummary: this.getFnSummary(this.state.columnFn),
    }

    const newColumns = columns.map((col) => {
      if (col.field === this.newColumn.field) {
        return {
          ...col,
          ...newParams,
        }
      }
      return col
    })

    this.tableRef?.ref?.updateColumn?.(this.newColumn.field, newParams)

    this.setState({ columns: newColumns })
  }

  onAddColumnConfirm = () => {
    const newColumns = _cloneDeep(this.props.columns)
    newColumns.push(this.newColumn)

    this.props.onConfirm(newColumns)
  }

  changeChunkValue = (value, type, i) => {
    if (type === 'column') {
      const column = this.props.columns.find((col) => col.field === value)
      const columnFn = _cloneDeep(this.state.columnFn)
      if (columnFn[i]) {
        columnFn[i].value = value
        columnFn[i].column = column
      }

      this.setState({ columnFn })
    }
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className='custom-column-modal'
          title='Configure Custom Column'
          isVisible={this.props.isOpen}
          width='90vw'
          height='100vh'
          confirmText='Save Column'
          shouldRender={this.props.shouldRender}
          onClose={this.props.onClose}
          onConfirm={this.onAddColumnConfirm}
        >
          <div className='custom-column-modal'>
            <div>
              <Input
                ref={(r) => (this.inputRef = r)}
                fullWidth
                focusOnMount
                label='Column Name'
                placeholder='eg. "Difference"'
                value={this.state.columnName}
                onChange={(e) => this.setState({ columnName: e.target.value })}
              />

              <div className='react-autoql-input-label'>Column Formula</div>
              <div className='react-autoql-formula-builder-container'>
                <div className='react-autoql-formula-builder-button-wrapper'>
                  {this.state.columnFn.map((chunk, i) => {
                    if (chunk.type === 'column') {
                      return (
                        <Select
                          key={`custom-column-select-${i}`}
                          placeholder='Select a Column'
                          value={chunk.value}
                          onChange={(value) => this.changeChunkValue(value, chunk.type, i)}
                          options={getVisibleColumns(this.props.columns).map((col) => {
                            return {
                              value: col.field,
                              label: col.title,
                              listLabel: col.title,
                              icon: 'table',
                            }
                          })}
                        />
                      )
                    } else if (chunk.type === 'operator') {
                    } else if (chunk.type === 'number') {
                    }
                  })}
                  <Button className='react-autoql-operator-select' icon='plus'>
                    <span> CONCAT</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className='react-autoql-input-label'>Preview</div>
            <div className='react-autoql-table-preview-container'>
              <ChataTable
                key={this.TABLE_ID}
                ref={(r) => (this.tableRef = r)}
                authentication={this.props.authentication}
                dataFormatting={this.props.dataFormatting}
                response={this.props.response}
                queryRequestData={this.props.queryRequestData}
                popoverParentElement={this.props.popoverParentElement}
                tooltipID={this.props.tooltipID}
                columns={this.state.columns}
                useInfiniteScroll={false}
                supportsDrilldowns={false}
                pageSize={10}
              />
            </div>
          </div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
