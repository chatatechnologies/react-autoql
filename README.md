# Installation

#### Using npm or yarn

```
$ npm install chata-ai
```

```
$ yarn add chata-ai
```

#### Import in Browser

# Environment Support

Modern browsers and IE11+

# Usage

```
import { ChatDrawer } from 'chata-ai';

ReactDOM.render(<ChatDrawer />, mountNode);
```

# Components

### ChatDrawer

A chat panel that slides open from the edge of the screen.

#### Props

| Prop            | Description                                                             |                                     Type                                     | Default Value |
| --------------- | ----------------------------------------------------------------------- | :--------------------------------------------------------------------------: | :-----------: |
| isVisible       | Whether the drawer is open or not                                       |                                   Boolean                                    |     false     |
| placement       | Which edge of the screen to place the drawer                            | String: 'left' &#124;&#124; 'right' &#124;&#124; 'top' &#124;&#124; 'bottom' |    'right'    |
| width           | Set the drawer width in pixels. For placements "left" and "right" only  |                          String &#124;&#124; Number                          |      500      |
| height          | Set the drawer height in pixels. For placements "top" and "bottom" only |                          String &#124;&#124; Number                          |      350      |
| maskClosable    | Whether or not onHandleClick should be called on mask click             |                                   Boolean                                    |     true      |
| showHandle      | Whether or not to show the handle                                       |                                   Boolean                                    |     true      |
| theme           | Color theme for the chat drawer                                         |                     String: 'light' &#124;&#124; 'dark'                      |    'light'    |
| shiftScreen     | Whether or not to shift the whole screen over when the drawer opens     |                                   Boolean                                    |     false     |
| onVisibleChange | Callback after the drawer closes or opens                               |                                   Function                                   |       -       |
| onHandleClick   | Callback when drawer handle is clicked                                  |                                   Function                                   |       -       |
| handleStyles    | Specify css styles for the handle                                       |                                    Object                                    |       -       |

#### Example

```
import React, { Component } from 'react'
import { ChatDrawer } from 'chata-ai'

export default class App extends Component {
  state = {
    isVisible: false
  }

  render = () => {
    return (
      <ChatDrawer
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
        placement="bottom"
        maskClosable
        showMask={false}
        width="700px"
        handleStyles={{ left: 'unset', right: '25px' }}
      />
    )
  }
}
```
