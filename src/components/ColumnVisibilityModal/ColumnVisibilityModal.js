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
    columns: this.props.columns.map((col) => {
      return {
        ...col,
        content: col.display_name || col.title,
        checked: col.visible,
      }
    }),
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.setState({
        columns: this.props.columns.map((col) => {
          return {
            ...col,
            content: col.display_name || col.title,
            checked: col.visible,
          }
        }),
      })
    }
  }

  render = () => {
    return (
      <Modal
        themeConfig={this.props.themeConfig}
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        onConfirm={() =>
          this.props.onConfirm(
            this.state.columns.map((col) => {
              return {
                ...col,
                visible: col.checked,
                content: undefined,
                checked: undefined,
              }
            })
          )
        }
        title="Show/Hide Columns"
        enableBodyScroll={true}
        width="600px"
        confirmText="Apply"
        style={{ marginTop: '45px' }}
        confirmLoading={this.props.isSettingColumns}
      >
        <div data-test="column-visibility-modal" style={{ padding: '0 15px' }}>
          <SelectableList
            themeConfig={this.props.themeConfig}
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
