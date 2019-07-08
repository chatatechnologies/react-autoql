import React, { Component } from 'react'
import { ChatDrawer, ChataBarChart } from '@chata-ai/core'
import uuid from 'uuid'

export default class App extends Component {
  state = {
    isVisible: false,
    placement: 'right',
    showHandle: true,
    theme: 'light'
  }

  render = () => {
    return (
      <div>
        <ChataBarChart
          data={[
            { key: uuid.v4(), label: 'A', value: 5 },
            { key: uuid.v4(), label: 'B', value: 10 },
            { key: uuid.v4(), label: 'C', value: 1 },
            { key: uuid.v4(), label: 'D', value: -4 },
            { key: uuid.v4(), label: 'E', value: 9 },
            { key: uuid.v4(), label: 'F', value: -1 },
            { key: uuid.v4(), label: 'G', value: -5 },
            { key: uuid.v4(), label: 'H', value: 15 },
            { key: uuid.v4(), label: 'I', value: -12 },
            { key: uuid.v4(), label: 'J', value: 3 },
            { key: uuid.v4(), label: 'K', value: 2 },
            { key: uuid.v4(), label: 'L', value: 1 },
            { key: uuid.v4(), label: 'M', value: 5 },
            { key: uuid.v4(), label: 'N', value: 8 },
            { key: uuid.v4(), label: 'O', value: 18 },
            { key: uuid.v4(), label: 'P', value: -3 },
            { key: uuid.v4(), label: 'Q', value: 9 },
            { key: uuid.v4(), label: 'R', value: 14 },
            { key: uuid.v4(), label: 'S', value: 5 },
            { key: uuid.v4(), label: 'T', value: 10 },
            { key: uuid.v4(), label: 'U', value: 1 },
            { key: uuid.v4(), label: 'V', value: -4 },
            { key: uuid.v4(), label: 'W', value: -9 },
            { key: uuid.v4(), label: 'X', value: 2 },
            { key: uuid.v4(), label: 'Y', value: 5 },
            { key: uuid.v4(), label: 'Z', value: 7 },
            { key: uuid.v4(), label: 'AA', value: -7 },
            { key: uuid.v4(), label: 'BB', value: 3 },
            { key: uuid.v4(), label: 'CC', value: 8 },
            { key: uuid.v4(), label: 'DD', value: 12 }
          ]}
          size={[500, 300]}
          dataValue="value"
          labelValue="label"
          tooltipFormatter={data => {
            return `<div>
                <span>Name: ${data.label}</span>
                <br />
                <span>Value: ${data.value}</span>
              </div>`
          }}
        />
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
