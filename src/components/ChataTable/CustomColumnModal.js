import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'
import { authenticationDefault, autoQLConfigDefault, dataFormattingDefault } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import { authenticationType, autoQLConfigType, dataFormattingType } from '../../props/types'

export default class CustomColumnModal extends React.Component {
  constructor(props) {
    super(props)

    this.state = {}
  }

  static propTypes = {
    // Global
    authentication: authenticationType,
    autoQLConfig: autoQLConfigType,
    dataFormatting: dataFormattingType,

    onConfirm: PropTypes.func,
    onClose: PropTypes.func,
  }

  static defaultProps = {
    // Global
    authentication: authenticationDefault,
    autoQLConfig: autoQLConfigDefault,
    dataFormatting: dataFormattingDefault,

    onConfirm: () => {},
    onClose: () => {},
  }

  addColumn = () => {
    const index = this.props.tableConfig?.numberColumnIndex

    const title = 'Custom'

    const mutator = (value, data, type, params, component) => {
      //value - original value of the cell
      //data - the data for the row
      //type - the type of mutation occurring  (data|edit)
      //params - the mutatorParams object from the column definition
      //component - when the "type" argument is "edit", this contains the cell component for the edited cell, otherwise it is the column component for the column
      return data[index] / 2 //return the sum of the other two columns.
    }

    const field = `${this.props.columns.length}`

    const newColumn = {
      ...this.props.columns[index],
      display_name: title,
      title,
      field,
      custom: true,
      fnSummary: `${this.props.columns[index]?.display_name} / 2`,
      mutator,
    }

    const newColumns = _cloneDeep(this.props.columns)
    newColumns[index].mutateLink = field

    newColumns.push(newColumn)

    this.props.onConfirm(newColumns)
  }

  render = () => {
    return (
      <ErrorBoundary>
        <Modal
          className='custom-column-modal'
          //   contentClassName=''
          title='Configure Custom Column'
          isVisible={this.props.isOpen}
          width='90vw'
          height='100vh'
          confirmText='Save Column'
          shouldRender={this.props.shouldRender}
          onClose={this.props.onClose}
          onConfirm={this.addColumn}
        >
          <div>Custom column</div>
        </Modal>
      </ErrorBoundary>
    )
  }
}
