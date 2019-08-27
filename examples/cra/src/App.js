import React, { Component, Fragment } from 'react'
import { ChatDrawer, ResponseRenderer, ChatBar } from '@chata-ai/core'
import uuid from 'uuid'

import { Radio, Input, InputNumber, Switch, Button } from 'antd'
import 'antd/dist/antd.css'
import './index.css'

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

  createRadioInputGroup = (title, propName, propValues = []) => {
    return (
      <p>
        <h4>{title}</h4>
        <Radio.Group
          defaultValue={this.state[propName]}
          onChange={e => this.setState({ [propName]: e.target.value })}
          buttonStyle="solid"
        >
          {propValues.map(propValue => {
            return (
              <Radio.Button value={propValue}>
                {propValue.toString()}
              </Radio.Button>
            )
          })}
        </Radio.Group>
      </p>
    )
  }

  createBooleanRadioGroup = (title, propName, propValues = []) => {
    return (
      <p>
        <h4>{title}</h4>
        <Switch
          defaultChecked={this.state[propName]}
          checked={this.state[propName] === true}
          onChange={e => this.setState({ [propName]: e })}
        />
      </p>
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
        <h1>Data Source</h1>
        {this.createBooleanRadioGroup('Demo Data', 'demo', [true, false])}
        {!this.state.demo && (
          <Fragment>
            <h4>API key</h4>
            <Input
              // type="text"
              onChange={e => {
                this.setState({ apiKey: e.target.value })
              }}
              value={this.state.apiKey}
            />
            <h4>Customer ID</h4>
            <Input
              // type="text"
              onChange={e => {
                this.setState({ customerId: e.target.value })
              }}
              value={this.state.customerId}
            />
            <h4>User ID (email)</h4>
            <Input
              // type="text"
              onChange={e => {
                this.setState({ userId: e.target.value })
              }}
              value={this.state.userId}
            />
          </Fragment>
        )}
        <h1>Drawer Props</h1>
        <Button
          onClick={() => this.setState({ componentKey: uuid.v4() })}
          style={{ marginRight: '10px' }}
        >
          Reload Drawer
        </Button>
        <Button
          onClick={() => this.setState({ isVisible: true })}
          type="primary"
        >
          Open Drawer
        </Button>
        {this.createBooleanRadioGroup('Show Drawer Handle', 'showHandle', [
          true,
          false
        ])}
        {this.createBooleanRadioGroup('Show Mask', 'showMask', [true, false])}
        {this.createRadioInputGroup('Theme', 'theme', ['light', 'dark'])}
        {this.createRadioInputGroup('Drawer Placement', 'placement', [
          'top',
          'bottom',
          'left',
          'right'
        ])}
        <h4>Customer Name</h4>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="text"
          onChange={e => {
            this.setState({ customerName: e.target.value })
          }}
          value={this.state.customerName}
        />
        {this.createBooleanRadioGroup(
          'Clear All Messages on Close',
          'clearOnClose',
          [true, false]
        )}
        <h4>Height</h4>
        <h5>Only for top/bottom placement</h5>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <InputNumber
          // type="number"
          onChange={e => {
            this.setState({ height: e.target.value })
          }}
          value={this.state.height}
        />
        <h4>Width</h4>
        <h5>Only for left/right placement</h5>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <InputNumber
          type="number"
          onChange={e => {
            this.setState({ width: e.target.value })
          }}
          value={this.state.width}
        />
        <h4>Title</h4>
        <Input
          type="text"
          onChange={e => {
            this.setState({ title: e.target.value })
          }}
          value={this.state.title}
        />
        <h4>Light Theme Accent Color</h4>
        <h5>
          For production version, the user will just choose "accentColor" and it
          <br />
          will be applied to whatever theme. If not provided, the default color
          <br />
          will be used
        </h5>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="color"
          onChange={e => {
            this.setState({ lightAccentColor: e.target.value })
          }}
          value={this.state.lightAccentColor}
        />
        <h4>Dark Theme Accent Color</h4>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="color"
          onChange={e => {
            this.setState({ darkAccentColor: e.target.value })
          }}
          value={this.state.darkAccentColor}
        />
        <h4>Maximum Number of Messages</h4>
        <InputNumber
          type="number"
          onChange={e => {
            this.setState({ maxMessages: e.target.value })
          }}
          value={this.state.maxMessages}
        />
        {this.createBooleanRadioGroup(
          'Enable Autocomplete',
          'enableAutocomplete',
          [true, false]
        )}
        {this.createBooleanRadioGroup('Enable Safety Net', 'enableSafetyNet', [
          true,
          false
        ])}
        {this.createBooleanRadioGroup(
          'Enable Speech to Text',
          'enableVoiceRecord',
          [true, false]
        )}
      </div>
    )
  }

  render = () => {
    console.log(this.state.demo)
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
