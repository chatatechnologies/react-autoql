import React, { Component } from 'react'
import { ChatDrawer } from '@chata-ai/core'

export default class App extends Component {
  state = {
    isVisible: true,
    placement: 'right',
    showHandle: true,
    theme: 'light'
  }

  render = () => {
    return (
      <div>
        <button onClick={() => this.setState({ isVisible: true })}>
          Open Drawer
        </button>
        <br />
        <br />
        <label className="radio">
          <input
            type="radio"
            name="placement"
            value="top"
            checked={this.state.placement === 'top'}
            onChange={e => this.setState({ placement: e.target.value })}
          />
          Top
        </label>
        <br />
        <label className="radio">
          <input
            type="radio"
            name="placement"
            value="bottom"
            checked={this.state.placement === 'bottom'}
            onChange={e => this.setState({ placement: e.target.value })}
          />
          Bottom
        </label>
        <br />
        <label className="radio">
          <input
            type="radio"
            name="placement"
            value="left"
            checked={this.state.placement === 'left'}
            onChange={e => this.setState({ placement: e.target.value })}
          />
          Left
        </label>
        <br />
        <label className="radio">
          <input
            type="radio"
            name="placement"
            value="right"
            checked={this.state.placement === 'right'}
            onChange={e => this.setState({ placement: e.target.value })}
          />
          Right
        </label>
        <br />
        <br />
        <label className="radio">
          <input
            type="radio"
            name="handle"
            value={true}
            checked={this.state.showHandle}
            onChange={e => this.setState({ showHandle: true })}
          />
          Show handle
        </label>
        <label className="radio">
          <input
            type="radio"
            name="handle"
            value={false}
            checked={!this.state.showHandle}
            onChange={e => this.setState({ showHandle: false })}
          />
          Hide Handle
        </label>
        <br />
        <br />
        <label className="radio">
          <input
            type="radio"
            name="theme"
            value="light"
            checked={this.state.theme === 'light'}
            onChange={e => this.setState({ theme: e.target.value })}
          />
          Light Theme
        </label>
        <label className="radio">
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={this.state.theme === 'dark'}
            onChange={e => this.setState({ theme: e.target.value })}
          />
          Dark Theme
        </label>
        <ChatDrawer
          isVisible={this.state.isVisible}
          onHandleClick={() =>
            this.setState({ isVisible: !this.state.isVisible })
          }
          onMaskClick={() => this.setState({ isVisible: false })}
          showHandle={this.state.showHandle}
          placement={this.state.placement}
          customerName="Nikki"
          showMask
          height="500px"
          token="454317d6-f803-488b-8a8f-5a618b0b67f5"
          enableAutocomplete={true}
          // enableVoiceRecord
          // width="700px"
          // handleStyles={{ right: '25px' }}
          // clearOnClose
          // inputStyles
          // autocompleteStyles
          // maxMessages
          // accentColor="#28a8e0"
          title="Chat with your data"
          enableSafetyNet
          theme={this.state.theme}
        />
      </div>
    )
  }
}
