import React from 'react'
import PropTypes from 'prop-types'
import { MultiSelect } from '../MultiSelect'
import { SubjectName } from '../DataExplorer/SubjectName'
import { DataExplorerTypes } from 'autoql-fe-utils'
import { Icon } from '../Icon'
import { Spinner } from '../Spinner'
import './FieldSelector.scss'

export default class FieldSelector extends React.Component {
  static propTypes = {
    columns: PropTypes.array,
    selectedColumns: PropTypes.array,
    onColumnsChange: PropTypes.func,
    selectedSubject: PropTypes.shape({
      type: PropTypes.string,
    }),
    selectedTopic: PropTypes.shape({}),
    disabled: PropTypes.bool,
    loading: PropTypes.bool,
  }

  static defaultProps = {
    columns: [],
    selectedColumns: [],
    onColumnsChange: () => {},
    selectedSubject: null,
    selectedTopic: null,
    disabled: false,
    loading: false,
  }

  render = () => {
    const { columns, selectedColumns, onColumnsChange, selectedSubject, selectedTopic, disabled, loading } = this.props

    // Always render the FieldSelector, even when columns are not loaded yet
    if (!columns?.length && !loading) {
      return null
    }

    let fieldsDropdownTitle = 'Select fields of interest'
    if (selectedSubject?.type === DataExplorerTypes.VL_TYPE) {
      if (!selectedTopic) {
        return null
      }

      fieldsDropdownTitle = (
        <span>
          Select fields from <SubjectName subject={selectedTopic} />
        </span>
      )
    }

    return (
      <>
        <span className={`react-autoql-data-preview-selected-columns-selector ${disabled ? 'disabled' : ''}`}>
          <MultiSelect
            title={
              <span className='field-selector-title'>
                <Icon name='filter' size='small' />
                SELECT FIELDS
              </span>
            }
            size='small'
            align='start'
            popupClassname='react-autoql-sample-queries-filter-dropdown'
            options={
              columns?.map((col) => {
                return {
                  value: col.name,
                  label: col.display_name,
                }
              }) || []
            }
            listTitle={fieldsDropdownTitle}
            selected={selectedColumns.map((index) => columns?.[index]?.name).filter(Boolean)}
            onChange={(selectedColumnNames) => {
              if (disabled || loading || !columns?.length) return
              const selectedColumnIndexes = selectedColumnNames.map((name) =>
                columns.findIndex((col) => name === col.name),
              )
              onColumnsChange(selectedColumnIndexes)
            }}
            disabled={disabled || loading}
          />
          {loading && (
            <div className='field-selector-loading-overlay'>
              <Spinner />
            </div>
          )}
        </span>
        {!!selectedColumns?.length && (
          <span
            className={`react-autoql-data-preview-selected-columns-clear-btn ${disabled || loading ? 'disabled' : ''}`}
            onClick={() => !disabled && !loading && onColumnsChange([])}
          >
            CLEAR
          </span>
        )}
      </>
    )
  }
}
