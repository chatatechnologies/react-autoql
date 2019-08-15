# Installation

#### Using npm or yarn

```
$ npm install @chata-ai/core
```

```
$ yarn add @chata-ai/core
```

#### Import in Browser

# Usage

```
import { ChatDrawer } from '@chata-ai/core';

ReactDOM.render(<ChatDrawer />, mountNode);
```

# Environment Support

Modern browsers and IE11+

Support for voice to text button in Google Chrome only. Will fail silently in other browsers.

# Components

### ChatDrawer

A chat panel that slides open from the edge of the screen.

#### Props

| Prop               | Description                                                                                                           |                                     Type                                     |                 Default Value                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------: | :-------------------------------------------: |
| isVisible          | Whether the drawer is open or not                                                                                     |                                   Boolean                                    |                     false                     |
| placement          | Which edge of the screen to place the drawer                                                                          | String: 'left' &#124;&#124; 'right' &#124;&#124; 'top' &#124;&#124; 'bottom' |                    'right'                    |
| width              | Set the drawer width in pixels. For placements "left" and "right" only                                                |                          String &#124;&#124; Number                          |                      500                      |
| height             | Set the drawer height in pixels. For placements "top" and "bottom" only                                               |                          String &#124;&#124; Number                          |                      350                      |
| title              | Text that appears in the top bar of the chat                                                                          |                                    String                                    |             'Chat with your data'             |
| maskClosable       | Whether or not onHandleClick should be called on mask click                                                           |                                   Boolean                                    |                     true                      |
| showHandle         | Whether or not to show the handle                                                                                     |                                   Boolean                                    |                     true                      |
| clearOnClose       | Whether or not to clear all messages when the drawer is closed                                                        |                                   Boolean                                    |                     false                     |
| maxMessages        | Maximum amount of messages to show in the drawer at one time. Oldest messages will be erased when maximum is exceeded |                                    Number                                    |                       -                       |
| theme              | Color theme for the chat drawer                                                                                       |                     String: 'light' &#124;&#124; 'dark'                      |                    'light'                    |
| accentColor        | Main accent color used in the chat drawer                                                                             |                                    String                                    | light theme: '#28a8e0', dark theme: '#525252' |
| shiftScreen        | Whether or not to shift the whole screen over when the drawer opens                                                   |                                   Boolean                                    |                     false                     |
| onVisibleChange    | Callback after the drawer closes or opens                                                                             |                                   Function                                   |                       -                       |
| onHandleClick      | Callback when drawer handle is clicked                                                                                |                                   Function                                   |                       -                       |
| onMaskClick        | Callback when mask is clicked (required when showHandle is false)                                                     |                                   Function                                   |                onHandleClick()                |
| handleStyles       | Specify css styles for the handle                                                                                     |                                    Object                                    |                       -                       |
| enableVoiceRecord  | Enables the speech to text button (only on Chrome. Fails silently on other browsers)                                  |                                   Boolean                                    |                     true                      |
| enableAutocomplete | Enables the auto-complete popup as a query is typed                                                                   |                                   Boolean                                    |                     true                      |
| autocompleteStyles | Object with css to style the auto-complete popup                                                                      |                                    Object                                    |                       -                       |
| enableSafetyNet    | If query is not understood, suggestions are returned for the user to choose from instead                              |                                   Boolean                                    |                     true                      |
| isDrilldownEnabled | A new query will be sent when double clicking on a table or chart element to "drill down" into the data               |                                   Boolean                                    |                     true                      |
| customerName       | Name used in the intro message (ie. "Hi John! I am here...")                                                          |                                    String                                    |                    'there'                    |

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
