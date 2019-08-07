import React, { Component } from 'react'
import { ChatDrawer, ResponseRenderer, ChatBar } from '@chata-ai/core'

export default class App extends Component {
  state = {
    isVisible: true,
    placement: 'bottom',
    showHandle: true,
    theme: 'dark',
    response: null
  }

  render = () => {
    return (
      <div>
        <ChatBar
          ref={r => (this.chatBarRef = r)}
          autoCompletePlacement="bottom"
          onSubmit={() => this.setState({ response: null })}
          onResponseCallback={response => {
            this.setState({ response })
          }}
          showChataIcon
          showLoadingDots
        />
        {this.state.response ? (
          <div
            style={{
              height: '300px',
              padding: '30px',
              fontFamily: 'Helvetica, Arial, Sans-Serif', // Text, tables, and charts will inherit font
              color: '#565656' // Text, tables, and charts will inherit text color
            }}
          >
            <ResponseRenderer
              // displayType="column"
              chatBarRef={this.chatBarRef}
              response={this.state.response}
            />
          </div>
        ) : (
          <div
            style={{
              height: '75px',
              width: 'calc(100% - 60px)',
              padding: '30px',
              fontFamily: 'Helvetica, Arial, Sans-Serif',
              color: '#999',
              textAlign: 'center',
              fontSize: '14px'
            }}
          >
            <em>The response will go here</em>
          </div>
        )}
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
          // token="6f52a98e-e31f-4730-9dc6-f54df3a0d92e" // required
          // projectId={7077} // required
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
          enableAutocomplete={true}
          // enableVoiceRecord
          // width="700px"
          // handleStyles={{ right: '25px' }}
          // clearOnClose
          // inputStyles
          // autocompleteStyles
          // maxMessages={5}
          // accentColor="#28a8e0"
          title="Chat with your data"
          enableSafetyNet
          theme={this.state.theme}
        />
      </div>
    )
  }
}
