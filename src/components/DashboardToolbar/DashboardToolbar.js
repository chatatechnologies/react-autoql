import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { Menu, MenuItem } from '../Menu'
import { Popover } from '../Popover'
import { ErrorBoundary } from '../../containers/ErrorHOC'
import { ConfirmModal } from '../ConfirmModal'
import { Modal } from '../Modal'
import { Input } from '../Input'
import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'
import FilterAutocomplete from './DashboardFilterAutocomplete'
import { Chip } from '../Chip'
import DashboardSlicer from './DashboardSlicer'

import './DashboardToolbar.scss'

export class DashboardToolbarWithoutRef extends React.Component {
  constructor(props) {
    super(props)

    this.dashboardSlicingFeatureToggle = false
  }

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
    onDownloadClick: PropTypes.func,
    onSlicerChange: PropTypes.func,
    tooltipID: PropTypes.string,
    title: PropTypes.string,
    refreshInterval: PropTypes.number,
    enableAutoRefresh: PropTypes.bool,
    dashboardId: PropTypes.string,
    authentication: PropTypes.shape({}),
    context: PropTypes.string,
    slicerSuggestion: PropTypes.string,
    isDashboardFullyExecuted: PropTypes.bool,
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
    onDownloadClick: () => {},
    onSlicerChange: () => {},
    tooltipID: undefined,
    title: 'Untitled Dashboard',
    refreshInterval: 60,
    enableAutoRefresh: false,
    dashboardId: undefined,
    authentication: undefined,
    context: undefined,
    value: null,
    slicerSuggestion: undefined,
    isDashboardFullyExecuted: false,
  }

  state = {
    isOptionsMenuOpen: false,
    isConfirmCloseModalOpen: false,
    isRenameModalOpen: false,
    dashboardFilters: [],
    dashboardName: '',
    selectedSlicer: null,
  }

  componentDidMount = () => {
    // Load slicer from localStorage
    this.loadSlicerFromStorage()
  }

  getStorageKey = () => {
    const dashboardId = this.props.dashboardId || 'default'
    return `react-autoql-dashboard-slicer-${dashboardId}`
  }

  loadSlicerFromStorage = () => {
    try {
      const storageKey = this.getStorageKey()
      const storedSlicer = localStorage.getItem(storageKey)
      if (storedSlicer) {
        const slicer = JSON.parse(storedSlicer)
        this.setState({ selectedSlicer: slicer })
        // Notify parent so it can be applied to queries
        this.props.onSlicerChange(slicer)
      }
    } catch (error) {
      console.error('Error loading slicer from localStorage:', error)
    }
  }

  saveSlicerToStorage = (slicer) => {
    try {
      const storageKey = this.getStorageKey()
      if (slicer) {
        localStorage.setItem(storageKey, JSON.stringify(slicer))
      } else {
        localStorage.removeItem(storageKey)
      }
    } catch (error) {
      console.error('Error saving slicer to localStorage:', error)
    }
  }

  handleSlicerChange = (slicer) => {
    this.setState({ selectedSlicer: slicer })
    // Save to localStorage as fallback
    this.saveSlicerToStorage(slicer)
    // Notify parent to apply to tiles
    this.props.onSlicerChange(slicer)
  }

  handleRemoveSlicer = () => {
    this.setState({ selectedSlicer: null })
    // Clear localStorage
    this.saveSlicerToStorage(null)
    // Notify parent to remove from tiles
    this.props.onSlicerChange(null)
  }

  renderSlicerChip = () => {
    if (!this.state.selectedSlicer) {
      return null
    }

    const displayName = this.state.selectedSlicer.format_txt || this.state.selectedSlicer.value
    const showMessage = this.state.selectedSlicer.show_message

    return (
      <Chip onDelete={this.handleRemoveSlicer}>
        <span>
          <strong>{displayName}</strong> {showMessage && <em>({showMessage})</em>}
        </span>
      </Chip>
    )
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (!prevState.isRenameModalOpen && this.state.isRenameModalOpen) {
      requestAnimationFrame(() => {
        this.inputRef?.focus()
      })
    } else if (prevState.isRenameModalOpen && !this.state.isRenameModalOpen) {
      this.setState({ dashboardName: '' })
    }

    if (this.state.dashboardFilters?.length !== prevState.dashboardFilters?.length) {
      // TODO: Apply filters to dashboard once API changes are complete
    }
  }

  handleDashboardRename = () => {
    this.props.onRenameClick(this.state.dashboardName)
    this.setState({ isRenameModalOpen: false })
  }

  formatRefreshInterval = () => {
    const { refreshInterval } = this.props
    const totalMinutes = Math.floor(refreshInterval / 60)

    if (totalMinutes >= 60) {
      // Handle hours (60 minutes = 1 hour)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60

      if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`
      } else {
        return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${minutes} ${minutes === 1 ? 'min' : 'mins'}`
      }
    } else {
      // Minutes only (minimum is 1 minute)
      return `${totalMinutes} ${totalMinutes === 1 ? 'min' : 'mins'}`
    }
  }

  getRefreshButtonTooltip = () => {
    const { refreshInterval, enableAutoRefresh } = this.props
    if (!refreshInterval || !enableAutoRefresh) {
      return 'Refresh Dashboard Data'
    }
    return `Click to refresh now. Dashboard auto-refreshes every ${this.formatRefreshInterval()}.`
  }

  optionsMenu = () => {
    return (
      <Menu>
        {this.props.isEditable && (
          <MenuItem
            title='Edit Dashboard'
            icon='edit'
            onClick={() => {
              this.props.onEditClick()
              this.setState({ isOptionsMenuOpen: false })
            }}
          />
        )}
        <MenuItem
          title='Export Snapshot (.aqldash)'
          icon='download'
          disabled={!this.props.isDashboardFullyExecuted}
          onClick={() => {
            this.props.onDownloadClick()
            this.setState({ isOptionsMenuOpen: false })
          }}
        />
        {this.props.isEditable && (
          <MenuItem
            title='Delete Dashboard'
            icon='trash'
            style={{ color: 'var(--react-autoql-danger-color)' }}
            onClick={() => {
              this.setState({ isOptionsMenuOpen: false, isConfirmDeleteModalVisible: true })
            }}
          />
        )}
      </Menu>
    )
  }

  removeFilter = (filterToRemove) => {
    this.setState((prevState) => ({
      dashboardFilters: prevState.dashboardFilters.filter((f) => f.keyword !== filterToRemove.keyword),
    }))
  }

  renderFilterInput = () => {
    return (
      <FilterAutocomplete
        authentication={this.props.authentication}
        onSelect={(selected) => {
          const filterExists = this.state.dashboardFilters.find((filter) => filter.keyword === selected.keyword)
          if (!filterExists) {
            this.setState({ dashboardFilters: [...this.state.dashboardFilters, selected] })
          }
        }}
      />
    )
  }

  renderFilterList = () => {
    return (
      <div>
        {this.state.dashboardFilters?.length ? <span>Filters: </span> : null}
        {this.state.dashboardFilters?.map((filter, i) => {
          const displayName = filter.format_txt ?? filter.keyword

          let displayNameType = ''
          if (filter.show_message) {
            displayNameType = `(${filter.show_message})`
          }

          return (
            <Chip key={filter.keyword} onDelete={() => this.removeFilter(filter)}>
              <span>
                <strong>{displayName}</strong> <em>{displayNameType}</em>
              </span>
            </Chip>
          )
        })}
      </div>
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
            <div className='react-autoql-dashboard-title-tools-container'>
              {this.dashboardSlicingFeatureToggle && !this.props.isEditing && this.renderFilterInput()}
              {!this.props.isEditing ? (
                <>
                  <Button
                    iconOnly
                    icon='refresh'
                    border={false}
                    tooltip={this.getRefreshButtonTooltip()}
                    tooltipID={this.props.tooltipID}
                    onClick={this.props.onRefreshClick}
                  />
                </>
              ) : (
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
              )}
              {!this.props.isEditing && (
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
          </div>
          {this.dashboardSlicingFeatureToggle && this.renderFilterList()}

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
                {this.dashboardSlicingFeatureToggle && this.renderFilterInput()}
              </div>
            </div>
          ) : null}
          <div className='react-autoql-dashboard-slicer-container'>
            {this.state.selectedSlicer ? (
              this.renderSlicerChip()
            ) : (
              <DashboardSlicer
                authentication={this.props.authentication}
                context={this.props.context}
                value={this.state.selectedSlicer}
                onChange={this.handleSlicerChange}
                placeholder='Select a slicer...'
                dashboardId={this.props.dashboardId}
                slicerSuggestion={this.props.slicerSuggestion}
              />
            )}
          </div>
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
        <Tooltip tooltipId={this.props.tooltipID} />
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <DashboardToolbarWithoutRef innerRef={ref} {...props} />)
