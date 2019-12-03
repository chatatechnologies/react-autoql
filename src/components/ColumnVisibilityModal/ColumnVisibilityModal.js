import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import _cloneDeep from 'lodash.clonedeep'

import { Modal } from '../Modal'
import { Checkbox } from '../Checkbox'

import styles from './ColumnVisibilityModal.css'

export default class ColumnVisibilityModal extends React.Component {
  static propTypes = {
    isSettingColumns: PropTypes.bool.isRequired
  }

  static defaultProps = {}

  state = {
    columns: this.props.columns
  }

  componentDidUpdate = prevProps => {
    if (this.props.isVisible && !prevProps.isVisible) {
      console.log('resetting columns to provided prop')
      this.setState({ columns: this.props.columns })
    }
  }

  render = () => {
    const columns = _cloneDeep(this.state.columns)

    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <Modal
          isVisible={this.props.isVisible}
          onClose={this.props.onClose}
          onConfirm={() => this.props.onConfirm(this.state.columns)}
          title="Show/Hide Columns"
          enableBodyScroll={true}
          width={600}
          confirmText="Save"
          style={{ marginTop: '45px' }}
          confirmLoading={this.props.isSettingColumns}
        >
          <div style={{ padding: '0 15px' }}>
            <div className="col-visibility-header">
              <div>Column Name</div>
              <div>Visible</div>
            </div>
            {columns &&
              columns.map((col, index) => {
                return (
                  <div className="col-visibility-line-item">
                    <div>{col.display_name || col.title}</div>
                    <div>
                      <Checkbox
                        checked={col.is_visible}
                        onChange={() => {
                          columns[index].is_visible = !columns[index].is_visible
                          this.setState({ columns })
                        }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </Modal>
      </Fragment>
    )
  }
}
