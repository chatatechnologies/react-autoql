import React, { Component } from 'react'
import { ChatDrawer } from 'chata-ai'

export default class App extends Component {
  state = {
    isVisible: false,
    placement: 'bottom',
    showHandle: true
  }

  render = () => {
    return (
      <div>
        <button onClick={() => this.setState({ isVisible: true })}>
          Open Drawer
        </button>
        <br />
        <br />
        <label class="radio">
          <input
            type="radio"
            name="placement"
            value="top"
            checked={this.state.placement === 'top'}
            onClick={e => this.setState({ placement: e.target.value })}
          />
          Top
        </label>
        <br />
        <label class="radio">
          <input
            type="radio"
            name="placement"
            value="bottom"
            checked={this.state.placement === 'bottom'}
            onClick={e => this.setState({ placement: e.target.value })}
          />
          Bottom
        </label>
        <br />
        <label class="radio">
          <input
            type="radio"
            name="placement"
            value="left"
            checked={this.state.placement === 'left'}
            onClick={e => this.setState({ placement: e.target.value })}
          />
          Left
        </label>
        <br />
        <label class="radio">
          <input
            type="radio"
            name="placement"
            value="right"
            checked={this.state.placement === 'right'}
            onClick={e => this.setState({ placement: e.target.value })}
          />
          Right
        </label>
        <br />
        <br />
        <label class="radio">
          <input
            type="radio"
            name="handle"
            value={true}
            checked={this.state.showHandle}
            onClick={e => this.setState({ showHandle: true })}
          />
          Show handle
        </label>
        <label class="radio">
          <input
            type="radio"
            name="handle"
            value={false}
            checked={!this.state.showHandle}
            onClick={e => this.setState({ showHandle: false })}
          />
          Hide Handle
        </label>
        <ChatDrawer
          isVisible={this.state.isVisible}
          onHandleClick={() =>
            this.setState({ isVisible: !this.state.isVisible })
          }
          onMaskClick={() => this.setState({ isVisible: false })}
          showHandle={this.state.showHandle}
          placement={this.state.placement}
          showMask
          height="500px"
          token="669a8d47-ce6d-4617-bdd3-19fdedb007c6"
          // width="700px"
          // handleStyles={{ right: '25px' }}
        />
      </div>
    )
  }
}
