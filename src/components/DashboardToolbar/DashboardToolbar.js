import React from 'react'
import PropTypes from 'prop-types'
import { Button } from '../Button'
import { ErrorBoundary } from '../../containers/ErrorHOC'

import './DashboardToolbar.scss'

export class DashboardToolbarWithoutRef extends React.Component {
  static propTypes = {
    onSaveClick: PropTypes.func,
    onCancelClick: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func,
    tooltipID: PropTypes.string,
    title: PropTypes.string,
  }

  static defaultProps = {
    onSaveClick: () => {},
    onCancelClick: () => {},
    onDeleteClick: () => {},
    onEditClick: () => {},
    tooltipID: undefined,
    title: 'Untitled Dashboard',
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
              {this.props.title}
              <Button
                className='react-autoql-dashboard-rename-btn'
                iconOnly
                icon='edit'
                border={false}
                tooltip='Rename Dashboard'
                tooltipID={this.props.tooltipID}
              />
            </div>
            {!this.props.isEditing && (
              <div className='react-autoql-dashboard-title-tools-container'>
                <Button
                  iconOnly
                  icon='refresh'
                  border={false}
                  tooltip='Refresh Dashboard Data'
                  tooltipID={this.props.tooltipID}
                />
                <Button
                  iconOnly
                  icon='more-vertical'
                  border={false}
                  tooltip='Options'
                  tooltipID={this.props.tooltipID}
                />
              </div>
            )}
          </div>
          {this.props.isEditing ? (
            <div className='react-autoql-dashboard-edit-toolbar-container'>
              <div className='react-autoql-dashboard-edit-toolbar-container-left'>
                <Button iconOnly icon='undo' border={false} tooltip='Undo' tooltipID={this.props.tooltipID} />
                <Button iconOnly icon='redo' border={false} tooltip='Redo' tooltipID={this.props.tooltipID} />
                <hr className='react-autoql-horizontal-divider' />
                <Button icon='plus' border={false} tooltip='Add Tile' tooltipID={this.props.tooltipID}>
                  Add Tile
                </Button>
              </div>
              <div className='react-autoql-dashboard-edit-toolbar-container-right'>
                <Button border={false} tooltip='Close without saving' tooltipID={this.props.tooltipID}>
                  Cancel
                </Button>
                <Button type='primary' icon='save' tooltip='Save and close' tooltipID={this.props.tooltipID}>
                  Save
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </ErrorBoundary>
    )
  }
}

export default React.forwardRef((props, ref) => <DashboardToolbarWithoutRef innerRef={ref} {...props} />)
