import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash.get'
import _cloneDeep from 'lodash.clonedeep'
import ReactTooltip from 'react-tooltip'
import Popover from 'react-tiny-popover'

import { Modal } from '../Modal'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Input } from '../Input'
import { LoadingDots } from '../LoadingDots'
import { Select } from '../Select'

import errorMessages from '../../js/errorMessages'
import { authenticationType } from '../../props/types'
import { authenticationDefault, getAuthentication } from '../../props/defaults'
import {
  fetchNotificationChannels,
  createNotificationChannel,
  sendDataToChannel,
  removeNotificationChannel,
} from '../../js/notificationService'

import './SendToTeamsModal.scss'
import { isChartType } from '../../js/Util'

export default class SendToTeamsModal extends React.Component {
  static propTypes = {
    authentication: authenticationType,
    isVisible: PropTypes.bool,
  }

  static defaultProps = {
    authentication: authenticationDefault,
    isVisible: false,
  }

  state = {
    channels: undefined,
    activePage: undefined,
    selectedChannel: undefined,
    isConnectingChannel: undefined,
    isFetchingChannels: undefined,
    isSendingData: undefined,
    selectedChannel: 0,
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.isVisible && !prevProps.isVisible) {
      this.fetchChannels()
      this.getAttachmentToSend()
    }
  }

  fetchChannels = () => {
    this.setState({ isFetchingChannels: true })
    fetchNotificationChannels({
      ...getAuthentication(this.props.authentication),
      channelType: 'teams',
    })
      .then((response) => {
        this.setState({
          channels: response.data.items,
          isFetchingChannels: false,
          activePage: 'channel-list',
        })
      })
      .catch((error) => {
        this.setState({ activePage: 'fetch-error', isFetchingChannels: false })
      })
  }

  renderEmptyListMessage = () => {
    return (
      <div className="slack-modal-empty-list-message">
        <div>
          You don't have any <Icon type="teams" /> Teams channels connected yet.
        </div>
        <Button
          type="primary"
          onClick={() => {
            this.setState({ activePage: 'connect-channel' })
          }}
        >
          <Icon type="plus" /> Connect a Channel
        </Button>
      </div>
    )
  }

  getAttachmentToSend = () => {
    this.attachment = undefined

    try {
      this.props.responseRef
        .getBase64Data()
        .then((data) => {
          this.attachment = data
        })
        .catch(() => {})
    } catch (error) {
      this.props.onErrorCallback(error)
    }
  }

  getVizType = () => {
    if (isChartType(_get(this.props.responseRef, 'state.displayType'))) {
      return 'chart'
    }
    return 'table'
  }

  sendDataToTeams = () => {
    this.setState({ isSendingData: true })
    const selectedChannel = this.state.channels[this.state.selectedChannel]

    if (this.props.responseRef && this.attachment) {
      sendDataToChannel({
        ...getAuthentication(this.props.authentication),
        channelId: selectedChannel.id,
        fileName: this.getVizType() === 'chart' ? 'chart.png' : 'table.csv',
        base64Data: this.attachment,
      })
        .then(() => {
          this.setState({ isSendingData: false })
          this.props.onClose()
        })
        .catch(() => {
          this.setState({ isSendingData: false })
        })
    } else {
      this.setState({ isSendingData: false })
      this.props.onErrorCallback()
    }
  }

  removeSelectedChannel = () => {
    const selectedChannel = this.state.channels[this.state.selectedChannel]
    removeNotificationChannel({
      ...getAuthentication(this.props.authentication),
      channelId: selectedChannel.id,
    })
      .then(() => {
        const channels = _cloneDeep(this.state.channels)
        channels.splice(this.state.selectedChannel, 1)

        this.setState({
          channels,
          isRemoveChannelConfirmOpen: false,
        })
      })
      .catch(() => {
        this.props.onErrorCallback()
      })
  }

  renderRemoveChannelBtn = () => {
    return (
      <Popover
        isOpen={this.state.isRemoveChannelConfirmOpen}
        onClickOutside={() =>
          this.setState({ isRemoveChannelConfirmOpen: false })
        }
        position="bottom"
        content={
          <div className="remove-channel-popover">
            <div className="react-autoql-confirm-text">
              <Icon className="react-autoql-confirm-icon" type="warning" />
              Are you sure you want to disconnect this channel?
            </div>
            <Button
              type="default"
              size="small"
              onClick={() =>
                this.setState({ isRemoveChannelConfirmOpen: false })
              }
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => this.removeSelectedChannel()}
            >
              Remove
            </Button>
          </div>
        }
      >
        <Icon
          className="remove-channel-btn"
          data-tip="Disconnect Channel"
          data-for="connect-to-slack-tooltips"
          type="trash"
          onClick={() => this.setState({ isRemoveChannelConfirmOpen: true })}
        />
      </Popover>
    )
  }

  renderChannelList = () => {
    if (this.state.isFetchingChannels) {
      return (
        <div className="loading-container-centered">
          <LoadingDots />
        </div>
      )
    } else if (this.state.channels.length === 0) {
      return this.renderEmptyListMessage()
    }

    const options = this.state.channels.map((channel, i) => {
      return {
        value: i,
        label: `${channel.channel_name}`,
      }
    })

    options.push({
      value: 'connect-channel',
      label: (
        <span>
          <Icon type="plus" /> Connect a New Channel
        </span>
      ),
    })

    const dataDescription =
      this.getVizType() === 'chart' ? 'chart image (.png)' : 'table (.csv)'

    return (
      <div className="slack-channel-list-container">
        <div className="slack-channel-list">
          <div>
            AutoQL will post an email to the selected Teams channel with the{' '}
            {dataDescription} attached.
          </div>
          <br />
          <div className="select-channel-titles">
            Post to:{' '}
            <Select
              options={options}
              value={this.state.selectedChannel}
              style={{ width: '300px' }}
              selectionPlaceholder="Select a Teams Channel"
              onChange={(value) => {
                if (value === 'connect-channel') {
                  this.setState({ activePage: 'connect-channel' })
                } else {
                  this.setState({ selectedChannel: value })
                }
              }}
            />
            {!Number.isNaN(Number(this.state.selectedChannel)) &&
              this.renderRemoveChannelBtn()}
          </div>
        </div>
      </div>
    )
  }

  renderFetchErrorMessage = () => {
    return (
      <div className="slack-modal-error-container">
        <div>{errorMessages.GENERAL_HTML}</div>
        <Button
          onClick={this.fetchChannels}
          type="default"
          loading={this.state.isFetchingChannels}
        >
          Try again
        </Button>
      </div>
    )
  }

  connectChannel = () => {
    this.setState({ isConnectingChannel: true })
    createNotificationChannel({
      ...getAuthentication(this.props.authentication),
      channelType: 'teams',
      channelName: this.state.channelName,
      channelEmail: this.state.channelEmail,
      userName: this.state.userName,
      userEmail: this.state.userEmail,
    })
      .then((response) => {
        const newChannel = response.data.data
        const newChannels = [...this.state.channels, newChannel]
        this.setState({
          isConnectingChannel: false,
          channels: newChannels,
          activePage: 'channel-list',

          channelEmail: undefined,
          channelName: undefined,
          userEmail: undefined,
          userName: undefined,
        })
      })
      .catch((error) => {
        this.props.onErrorCallback(error)
        this.setState({ isConnectingChannel: false })
      })
  }

  renderConnectChannelPage = () => {
    return (
      <div className="connect-channel-form-container">
        <div className="connect-channel-form">
          <div className="connect-channel-title">Connect a Teams Channel</div>
          <Icon
            data-tip="Back to List"
            className="connect-channel-back-btn"
            onClick={() => {
              this.setState({ activePage: 'channel-list' })
            }}
            type="back"
          />
          <div>Channel Name</div>
          <Input
            placeholder="e.g. general"
            value={this.state.channelName}
            onChange={(e) => {
              this.setState({ channelName: e.target.value })
            }}
          />
          <div>
            Channel Email Address{' '}
            <Popover
              isOpen={this.state.isTeamsEmailInstructionVisible}
              onClickOutside={() =>
                this.setState({ isTeamsEmailInstructionVisible: false })
              }
              position="top"
              content={
                <div className="slack-email-instructions-popover">
                  Instructions go here.
                </div>
              }
            >
              <span
                className="slack-email-instructions-button"
                onClick={() => {
                  this.setState({ isTeamsEmailInstructionVisible: true })
                }}
              >
                <Icon type="question" /> How do I find this?
              </span>
            </Popover>
          </div>
          <Input
            placeholder="e.g. 1234@amer.teams.ms"
            value={this.state.channelEmail}
            onChange={(e) => {
              this.setState({ channelEmail: e.target.value })
            }}
          />
          <div>
            Your Name{' '}
            <span className="form-subtitle">
              (Displayed as sender name in Teams)
            </span>
          </div>
          <Input
            placeholder="e.g. Jane Smith"
            value={this.state.userName}
            onChange={(e) => {
              this.setState({ userName: e.target.value })
            }}
          />
          <div>
            Your Email{' '}
            <span className="form-subtitle">
              (Displayed as sender email in Teams)
            </span>
          </div>
          <Input
            placeholder="e.g. jane_smith@gmail.com"
            value={this.state.userEmail}
            onChange={(e) => {
              this.setState({ userEmail: e.target.value })
            }}
          />
          <div className="connect-channel-btn">
            <Button
              type="primary"
              onClick={this.connectChannel}
              loading={this.state.isConnectingChannel}
              disabled={
                !this.state.channelName ||
                !this.state.channelEmail ||
                !this.state.userName ||
                !this.state.userEmail
              }
            >
              {' '}
              Connect Channel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  renderActivePage = () => {
    const { activePage } = this.state
    if (activePage === 'fetch-error') {
      return this.renderFetchErrorMessage()
    } else if (this.state.isFetchingChannels) {
      return (
        <div className="loading-container-centered">
          <LoadingDots />
        </div>
      )
    } else if (activePage === 'connect-channel') {
      return this.renderConnectChannelPage()
    } else if (activePage === 'channel-list') {
      return this.renderChannelList()
    }
  }

  renderFooter = () => {
    if (
      this.state.activePage === 'channel-list' &&
      _get(this.state.channels, 'length') > 0
    ) {
      return (
        <div>
          <Button
            type="primary"
            className="send-to-slack-btn"
            disabled={
              !_get(this.state.channels, `${this.state.selectedChannel}`) ||
              !this.attachment
            }
            onClick={this.sendDataToTeams}
            loading={this.state.isSendingData}
          >
            <Icon type="send" /> Send to Teams
          </Button>
        </div>
      )
    }

    return null
  }

  render() {
    return (
      <Modal
        isVisible={this.props.isVisible}
        onClose={this.props.onClose}
        title={
          <span>
            Send to <Icon type="teams" /> Teams
          </span>
        }
        enableBodyScroll={true}
        width="750px"
        style={{ minHeight: '500px' }}
        showFooter={!!this.renderFooter()}
        footer={this.renderFooter()}
      >
        {this.renderActivePage()}
        <ReactTooltip
          className="react-autoql-drawer-tooltip"
          id="connect-to-slack-tooltips"
          effect="solid"
          place="top"
        />
      </Modal>
    )
  }
}
