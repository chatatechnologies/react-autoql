import React from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import { Modal } from '../Modal'
import { SelectableList } from '../SelectableList'

import { themeConfigType } from '../../props/types'
import { themeConfigDefault } from '../../props/defaults'

import './ColumnVisibilityModal.scss'

export default class ColumnVisibilityModal extends React.Component {
  static propTypes = {
    themeConfig: themeConfigType,
    isSettingColumns: PropTypes.bool,
  }

  static defaultProps = {
    themeConfig: themeConfigDefault,
    isSettingColumns: false,
  }

  state = {
    columns: this.props.columns,
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.setState({
        columns: this.props.columns,
      })
    }
  }

  render = () => {
    return (
      <Modal
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        onConfirm={() => this.props.onConfirm(this.state.columns)}
        title="Show/Hide Columns"
        enableBodyScroll={true}
        width="600px"
        confirmText="Apply"
        style={{ marginTop: '45px' }}
        confirmLoading={this.props.isSettingColumns}
      >
        <div data-test="column-visibility-modal" style={{ padding: '0 15px' }}>
          <SelectableList
            columns={[{ name: 'Column Name' }, { name: 'Visibility ' }]}
            items={this.state.columns}
            onChange={(columns) => {
              this.setState({ columns })
            }}
          />
        </div>
      </Modal>
    )
  }
}
