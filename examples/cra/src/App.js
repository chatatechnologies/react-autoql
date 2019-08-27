import React, { Component, Fragment } from 'react'
import { ChatDrawer, ResponseRenderer, ChatBar } from '@chata-ai/core'
import uuid from 'uuid'

export default class App extends Component {
  state = {
    componentKey: uuid.v4(),
    isVisible: true,
    placement: 'right',
    showHandle: true,
    theme: 'light',
    response: null,
    showMask: true,
    customerName: 'Nikki',
    enableAutocomplete: true,
    enableSafetyNet: true,
    enableVoiceRecord: true,
    clearOnClose: false,
    height: 500,
    width: 500,
    title: 'Chat with your data',
    lightAccentColor: '#28a8e0',
    darkAccentColor: '#525252',
    maxMessages: 2,
    demo: true,
    apiKey: '',
    customerId: '',
    userId: ''
  }

  createRadioInputGroup = (propName, propValues = []) => {
    return (
      <div>
        <br />
        {propName}
        {propValues.map(propValue => {
          return (
            <div key={`${propName}-${propValue}`}>
              <label className="radio">
                <input
                  type="radio"
                  name={propName}
                  value={propValue}
                  checked={this.state[propName] === propValue}
                  onChange={e => this.setState({ [propName]: e.target.value })}
                />
                {propValue.toString()}
              </label>
            </div>
          )
        })}
      </div>
    )
  }

  createBooleanRadioGroup = (propName, propValues = []) => {
    return (
      <div>
        <br />
        {propName}
        {propValues.map(propValue => {
          return (
            <div key={`${propName}-${propValue}`}>
              <label className="radio">
                <input
                  type="radio"
                  name={propName}
                  value={propValue}
                  checked={this.state[propName] === propValue}
                  onChange={e =>
                    this.setState({ [propName]: e.target.value === 'true' })
                  }
                />
                {propValue.toString()}
              </label>
            </div>
          )
        })}
      </div>
    )
  }

  renderChatBarAndResponse = () => {
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
      </div>
    )
  }

  renderPropOptions = () => {
    return (
      <div>
        <h1>Authentication</h1>
        {this.createBooleanRadioGroup('demo', [true, false])}
        {!this.state.demo && (
          <Fragment>
            API key
            <br />
            <input
              type="text"
              onChange={e => {
                this.setState({ apiKey: e.target.value })
              }}
              value={this.state.apiKey}
            />
            <br />
            Customer ID
            <br />
            <input
              type="text"
              onChange={e => {
                this.setState({ customerId: e.target.value })
              }}
              value={this.state.customerId}
            />
            <br />
            user ID (email)
            <br />
            <input
              type="text"
              onChange={e => {
                this.setState({ userId: e.target.value })
              }}
              value={this.state.userId}
            />
            <br />
          </Fragment>
        )}
        <h1>Drawer Props</h1>
        <button onClick={() => this.setState({ componentKey: uuid.v4() })}>
          Reload Drawer
        </button>
        <br />
        <button onClick={() => this.setState({ isVisible: true })}>
          Open Drawer
        </button>
        {this.createBooleanRadioGroup('showHandle', [true, false])}
        {this.createBooleanRadioGroup('showMask', [true, false])}
        {this.createRadioInputGroup('theme', ['light', 'dark'])}
        {this.createRadioInputGroup('placement', [
          'top',
          'bottom',
          'left',
          'right'
        ])}
        <br />
        customerName (must click 'reload drawer' to apply this)
        <br />
        <input
          type="text"
          onChange={e => {
            this.setState({ customerName: e.target.value })
          }}
          value={this.state.customerName}
        />
        {this.createBooleanRadioGroup('enableAutocomplete', [true, false])}
        {this.createBooleanRadioGroup('enableSafetyNet', [true, false])}
        {this.createBooleanRadioGroup('enableVoiceRecord', [true, false])}
        {this.createBooleanRadioGroup('clearOnClose', [true, false])}
        <br />
        <br />
        height: only for top/bottom placement (must reload drawer to apply)
        <br />
        <input
          type="number"
          onChange={e => {
            this.setState({ height: e.target.value })
          }}
          value={this.state.height}
        />
        <br />
        <br />
        width: only for left/right placement (must reload drawer to apply)
        <br />
        <input
          type="number"
          onChange={e => {
            this.setState({ width: e.target.value })
          }}
          value={this.state.width}
        />
        <br />
        <br />
        title
        <br />
        <input
          type="text"
          onChange={e => {
            this.setState({ title: e.target.value })
          }}
          value={this.state.title}
        />
        <br />
        <br />
        light theme accent color: for production version, the user will just
        choose "accentColor" and it will be applied to whatever theme. If not
        provided, the default color will be used (must reload drawer to apply)
        <br />
        <input
          type="color"
          onChange={e => {
            this.setState({ lightAccentColor: e.target.value })
          }}
          value={this.state.lightAccentColor}
        />
        <br />
        <br />
        dark theme accent color (must reload drawer to apply)
        <br />
        <input
          type="color"
          onChange={e => {
            this.setState({ darkAccentColor: e.target.value })
          }}
          value={this.state.darkAccentColor}
        />
        <br />
        <br />
        maxMessages
        <br />
        <input
          type="number"
          onChange={e => {
            this.setState({ maxMessages: e.target.value })
          }}
          value={this.state.maxMessages}
        />
      </div>
    )
  }

  render = () => {
    return (
      <div>
        {
          // this.renderChatBarAndResponse()
        }
        {this.renderPropOptions()}
        <ChatDrawer
          apiKey={this.state.apiKey} // required if demo is false
          customerId={this.state.customerId} // required if demo is false
          userId={this.state.userId} // required if demo is false
          key={this.state.componentKey}
          isVisible={this.state.isVisible}
          onHandleClick={() =>
            this.setState({ isVisible: !this.state.isVisible })
          }
          onMaskClick={() => this.setState({ isVisible: false })}
          showHandle={this.state.showHandle}
          placement={this.state.placement}
          customerName={this.state.customerName}
          showMask={this.state.showMask}
          enableAutocomplete={this.state.enableAutocomplete}
          enableVoiceRecord={this.state.enableVoiceRecord}
          clearOnClose={this.state.clearOnClose}
          width={this.state.width}
          height={this.state.height}
          title={this.state.title}
          enableSafetyNet={this.state.enableSafetyNet}
          theme={this.state.theme}
          accentColor={
            this.state.theme === 'light'
              ? this.state.lightAccentColor
              : this.state.darkAccentColor
          }
          maxMessages={this.state.maxMessages}
          demo={this.state.demo}
          // inputStyles
          // autocompleteStyles
          // handleStyles={{ right: '25px' }}
        />
      </div>
    )
  }
}
