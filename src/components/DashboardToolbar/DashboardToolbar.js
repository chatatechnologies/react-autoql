import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { Menu, MenuItem } from '../Menu'
import { Popover } from '../Popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { ConfirmModal } from '../ConfirmModal'
import { Modal } from '../Modal'
import { Input } from '../Input'

import './DashboardToolbar.scss'
import { Icon } from '../Icon'

export class DashboardToolbarWithoutRef extends React.Component {
  static propTypes = {
    onSaveClick: PropTypes.func,
    onCancelClick: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func,
    onRefreshClick: PropTypes.func,
    onAddTileClick: PropTypes.func,
    onUndoClick: PropTypes.func,
    onRedoClick: PropTypes.func,
    onRenameClick: PropTypes.func,
    tooltipID: PropTypes.string,
    title: PropTypes.string,
  }

  static defaultProps = {
    onSaveClick: () => {},
    onCancelClick: () => {},
    onDeleteClick: () => {},
    onEditClick: () => {},
    onRefreshClick: () => {},
    onAddTileClick: () => {},
    onUndoClick: () => {},
    onRedoClick: () => {},
    onRenameClick: () => {},
    tooltipID: undefined,
    title: 'Untitled Dashboard',
  }

  state = {
    isOptionsMenuOpen: false,
    isConfirmCloseModalOpen: false,
    isRenameModalOpen: false,
    dashboardName: '',
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!prevState.isRenameModalOpen && this.state.isRenameModalOpen) {
      requestAnimationFrame(() => {
        this.inputRef?.focus()
      })
    } else if (prevState.isRenameModalOpen && !this.state.isRenameModalOpen) {
      this.setState({ dashboardName: '' })
    }
  }

  handleDashboardRename = () => {
    this.props.onRenameClick(this.state.dashboardName)
    this.setState({ isRenameModalOpen: false })
  }

  optionsMenu = () => {
    return (
      <Menu>
        <MenuItem
          title='Edit Dashboard'
          icon='edit'
          onClick={() => {
            this.props.onEditClick()
            this.setState({ isOptionsMenuOpen: false })
          }}
        />
        <MenuItem
          title='Delete Dashboard'
          icon='trash'
          style={{ color: 'var(--react-autoql-danger-color)' }}
          onClick={() => {
            this.setState({ isOptionsMenuOpen: false, isConfirmDeleteModalVisible: true })
          }}
        />
      </Menu>
    )
  }

  renderRenameModal = () => {
    return (
      <Modal
        isVisible={this.state.isRenameModalOpen}
        onClose={() => this.setState({ isRenameModalOpen: false })}
        onConfirm={this.handleDashboardRename}
        title='Rename Dashboard'
        enableBodyScroll={false}
        width='400px'
        confirmText='Save'
        confirmDisabled={!this.state.dashboardName}
      >
        <Input
          fullWidth
          ref={(r) => (this.inputRef = r)}
          placeholder='Dashboard Name'
          value={this.state.dashboardName}
          label='Enter a new name for the dashboard'
          onChange={(e) => this.setState({ dashboardName: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              this.handleDashboardRename()
            }
          }}
        />
      </Modal>
    )
  }

  render = () => {
    return (
      <ErrorBoundary>
        <div
          className={`react-autoql-dashboard-toolbar-container
            ${this.props.isEditing ? 'react-autoql-dashboard-toolbar-container-editing' : ''}`}
        >
          <div className='react-autoql-dashboard-title-and-tools-container'>
            <div className='react-autoql-dashboard-title-container'>
              <div>{this.props.title}</div>
              {this.props.isEditable ? (
                <Button
                  className='react-autoql-dashboard-rename-btn'
                  iconOnly
                  icon='edit'
                  border={false}
                  tooltip='Rename Dashboard'
                  tooltipID={this.props.tooltipID}
                  onClick={() => {
                    this.setState({ isRenameModalOpen: true })
                  }}
                />
              ) : (
                <Icon
                  type='info'
                  info
                  tooltip='This Dashboard is static and cannot be edited or removed.'
                  tooltipID={this.props.tooltipID}
                  style={{ marginBottom: '3px', marginLeft: '10px' }}
                />
              )}
            </div>
            {!this.props.isEditing && (
              <div className='react-autoql-dashboard-title-tools-container'>
                <Button
                  iconOnly
                  icon='refresh'
                  border={false}
                  tooltip='Refresh Dashboard Data'
                  tooltipID={this.props.tooltipID}
                  onClick={this.props.onRefreshClick}
                />
                {this.props.isEditable && (
                  <Popover
                    align='end'
                    positions={['bottom', 'left', 'top', 'right']}
                    padding={0}
                    content={this.optionsMenu()}
                    isOpen={this.state.isOptionsMenuOpen}
                    onClickOutside={() => this.setState({ isOptionsMenuOpen: false })}
                  >
                    <Button
                      iconOnly
                      icon='more-vertical'
                      border={false}
                      tooltip='Options'
                      tooltipID={this.props.tooltipID}
                      onClick={() => this.setState({ isOptionsMenuOpen: true })}
                    />
                  </Popover>
                )}
              </div>
            )}
          </div>
          {this.props.isEditing ? (
            <div className='react-autoql-dashboard-edit-toolbar-container'>
              <div className='react-autoql-dashboard-edit-toolbar-container-left'>
                <Button
                  iconOnly
                  icon='undo'
                  border={false}
                  tooltip='Undo'
                  tooltipID={this.props.tooltipID}
                  onClick={this.props.onUndoClick}
                />
                <Button
                  iconOnly
                  icon='redo'
                  border={false}
                  tooltip='Redo'
                  tooltipID={this.props.tooltipID}
                  onClick={this.props.onRedoClick}
                />
                <hr className='react-autoql-horizontal-divider' />
                <Button
                  icon='plus'
                  border={false}
                  tooltip='Add Tile'
                  tooltipID={this.props.tooltipID}
                  onClick={this.props.onAddTileClick}
                >
                  Add Tile
                </Button>
              </div>
              <div className='react-autoql-dashboard-edit-toolbar-container-right'>
                <Button
                  border={false}
                  tooltip='Close without saving'
                  tooltipID={this.props.tooltipID}
                  onClick={() => this.setState({ isConfirmCloseModalOpen: true })}
                >
                  Cancel
                </Button>
                <Button
                  type='primary'
                  icon='save'
                  tooltip='Save and close'
                  tooltipID={this.props.tooltipID}
                  onClick={this.props.onSaveClick}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <ConfirmModal
          isVisible={this.state.isConfirmCloseModalOpen}
          onClose={() => this.setState({ isConfirmCloseModalOpen: false })}
          confirmText='Discard Changes'
          onConfirm={() => {
            this.props.onCancelClick()
            this.setState({ isConfirmCloseModalOpen: false })
          }}
        >
          <h3>Are you sure you want to leave?</h3>
          <p>Any unsaved changes will be lost.</p>
        </ConfirmModal>
        <ConfirmModal
          isVisible={this.state.isConfirmDeleteModalVisible}
          onClose={() => this.setState({ isConfirmDeleteModalVisible: false })}
          confirmText='Delete Dashboard'
          onConfirm={() => {
            this.props.onDeleteClick()
            this.setState({ isConfirmDeleteModalVisible: false })
          }}
        >
          <h3>Are you sure you want to delete this Dashboard?</h3>
          <p>
            This will permanently delete this Dashboard and all Tiles housed within it. This action cannot be undone. Do
            you wish to continue?
          </p>
        </ConfirmModal>
        {this.renderRenameModal()}
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <DashboardToolbarWithoutRef innerRef={ref} {...props} />)
