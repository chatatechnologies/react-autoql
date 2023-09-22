import React from 'react'
import PropTypes from 'prop-types'
import { deepEqual } from 'autoql-fe-utils'

import { Modal } from '../Modal'
import { SelectableList } from '../SelectableList'

import './ColumnVisibilityModal.scss'

export default class ColumnVisibilityModal extends React.Component {
  static propTypes = {
    isSettingColumns: PropTypes.bool,
  }

  static defaultProps = {
    isSettingColumns: false,
  }

  state = {
    columns: this.props.columns,
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState)
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.setState({
        columns: this.props.columns,
      })
    }
  }

  onListChange = (columns) => {
    this.setState({ columns })
  }

  onConfirm = () => this.props.onConfirm(this.state.columns)

  render = () => {
    return (
      <Modal
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        onConfirm={this.onConfirm}
        title='Show/Hide Columns'
        enableBodyScroll={true}
        width='600px'
        confirmText='Apply'
        confirmLoading={this.props.isSettingColumns}
      >
        <div data-test='column-visibility-modal' style={{ padding: '0 15px' }}>
          <SelectableList
            columns={[{ name: 'Column Name' }, { name: 'Visibility ' }]}
            items={this.state.columns}
            onChange={this.onListChange}
          />
        </div>
      </Modal>
    )
  }
}
