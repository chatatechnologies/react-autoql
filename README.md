# Demo

Live demo of ChatDrawer component: https://chata-ai-test-page.herokuapp.com/

# Installation

This is a library of react widgets. React must be installed as a prerequisite

#### Using npm or yarn

```
$ npm install react-chata
```

```
$ yarn add react-chata
```

#### Import in Browser

# Environment Support

- Modern browsers

- Support for voice to text button in Google Chrome only. Will fail silently in other browsers.

# Authentication

You will need a API key, customer ID, user ID, and domain to query your database through these widgets. Additionally, we require that you pass in a valid JWT token to be used on every endpoint call.

For more information on these requirements or how to retrieve/refresh your token please visit the chata.io developer site https://chata.readme.io

# Components

#### ChatDrawer

A chat panel that slides open from the edge of the screen. You will find a list of available props and their defaults in the next section.

```
import React, { Component } from 'react'
import { ChatDrawer } from 'react-chata';

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {
  state = {
    isVisible: false
  }

  render = () => {
    return (
      <ChatDrawer
        apiKey="your-api-key"
        customerId = "your-customer-id"
        userId = "your@email.com"
        domain = "https://yourdomain.com"

        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }}
      />
    )
  }
}
```

#### ChatBar and ResponseRenderer

A chat bar component and visualization component that can be placed anywhere. The ChatBar component ref should be passed into the ResponseRenderer component as a prop. This will link the two components together so they can interact with eachother.

You will find a list of available props and their defaults in the next section.

```
import React, { Component, Fragment } from 'react'
import { ChatBar, ResponseRenderer } from 'react-chata';

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {
  chatBarRef = null;

  render = () => {
    return (
      <Fragment>
        <ChatBar
          apiKey="your-api-key"
          customerId = "your-customer-id"
          userId = "your@email.com"
          domain = "https://yourdomain.com"

          ref={r => (this.chatBarRef = r)}
          onResponseCallback={response => {
            this.setState({ response })
          }}
        />
        <ResponseRenderer
          chatBarRef={this.chatBarRef}
          response={this.state.response}
        />
      </Fragment>
    )
  }
}
```

#### Dashboard

An editable dashboard component containing tiles with a query and a visualization. This component takes an array of tile objects as a prop for the initial render. If the user wants to edit the dashboard, the new tile state can be retrieved using the getDashboardTileState function and stored in a database for persistence.

You will find a list of available props and their defaults in the next section.

```
import React, { Component } from 'react'
import { Dashboard } from 'react-chata';

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {
  state = {
    tiles: [
      {
        key: '0',
        w: 3,
        h: 2,
        x: 0,
        y: 0,
        query: 'total profit this month',
        title: 'Profit - Current Month'
      },
      {
        key: '1',
        w: 3,
        h: 2,
        x: 3,
        y: 0,
        query: 'total profit last month',
        title: 'Profit - Previous Month'
      },
    ]
  }

  render = () => {
    return (
      <Dashboard
        apiKey="your-api-key"
        customerId = "your-customer-id"
        userId = "your@email.com"
        domain = "https://yourdomain.com"

        ref={r => (this.dashboardRef = r)}
        tiles={this.tiles}
        onChangeCallback={tiles => this.setState({ tiles })}
      />
    )
  }
}
```

# Props

#### ChatDrawer Props

| Prop                  | Type                                                                         | Default Value                                                                   |
| :-------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| token (Required)      | String                                                                       | -                                                                               |
| apiKey (Required)     | String                                                                       | -                                                                               |
| customerId (Required) | String                                                                       | -                                                                               |
| userId (Required)     | String                                                                       | -                                                                               |
| domain (Required)     | String                                                                       | -                                                                               |
| isVisible             | Boolean                                                                      | false                                                                           |
| placement             | String: 'left' &#124;&#124; 'right' &#124;&#124; 'top' &#124;&#124; 'bottom' | 'right'                                                                         |
| width                 | String &#124;&#124; Number                                                   | 500                                                                             |
| height                | String &#124;&#124; Number                                                   | 350                                                                             |
| theme                 | String: 'light' &#124;&#124; 'dark'                                          | 'light'                                                                         |
| accentColor           | String                                                                       | light theme: '#28a8e0', dark theme: '#525252'                                   |
| title                 | String                                                                       | 'Data Messenger'                                                                |
| showHandle            | Boolean                                                                      | true                                                                            |
| handleStyles          | Object                                                                       | {}                                                                              |
| onVisibleChange       | Function                                                                     | () => {}                                                                        |
| onHandleClick         | Function                                                                     | () => {}                                                                        |
| onMaskClick           | Function                                                                     | onHandleClick                                                                   |
| maskClosable          | Boolean                                                                      | true                                                                            |
| shiftScreen           | Boolean                                                                      | false                                                                           |
| customerName          | String                                                                       | 'there'                                                                         |
| introMessage          | String                                                                       | 'Hi {customerName}! I'm here to help you access, search and analyze your data.' |
| maxMessages           | Number                                                                       | undefined                                                                       |
| clearOnClose          | Boolean                                                                      | false                                                                           |
| enableVoiceRecord     | Boolean                                                                      | true                                                                            |
| enableAutocomplete    | Boolean                                                                      | true                                                                            |
| autocompleteStyles    | Object                                                                       | {}                                                                              |
| enableSafetyNet       | Boolean                                                                      | true                                                                            |
| disableDrilldowns     | Boolean                                                                      | false                                                                           |
| demo                  | Boolean                                                                      | false                                                                           |
| currencyCode          | String                                                                       | 'USD'                                                                           |
| languageCode          | String                                                                       | 'en-US'                                                                         |
| currencyDecimals      | Number                                                                       | 2                                                                               |
| quantityDecimals      | Number                                                                       | 1                                                                               |
| comparisonDisplay     | String                                                                       | 'ratio' &#124;&#124; 'percent'                                                  |
| fontFamily            | String                                                                       | 'sans-serif'                                                                    |
| chartColors           | Array                                                                        | ['#355C7D', '#6C5B7B', '#C06C84', '#f67280', '#F8B195']                         |

#### ChatBar Props

| Prop                  | Type     | Default Value |
| :-------------------- | :------- | :------------ |
| token (Required)      | String   | -             |
| apiKey (Required)     | String   | -             |
| customerId (Required) | String   | -             |
| userId (Required)     | String   | -             |
| domain (Required)     | String   | -             |
| isDisabled            | Boolean  | false         |
| onSubmit              | Function | () => {}      |
| onResponseCallback    | Function | () => {}      |
| autoCompletePlacement | String   | 'top'         |
| showLoadingDots       | Boolean  | true          |
| showChataIcon         | Boolean  | true          |
| enableVoiceRecord     | Boolean  | true          |
| enableAutocomplete    | Boolean  | true          |
| autocompleteStyles    | Object   | {}            |
| enableSafetyNet       | Boolean  | true          |
| disableDrilldowns     | Boolean  | false         |
| demo                  | Boolean  | false         |
| debug                 | Boolean  | false         |
| fontFamily            | String   | 'sans-serif'  |

#### ResponseRenderer Props

| Prop                | Type                     | Default Value                                           |
| :------------------ | :----------------------- | :------------------------------------------------------ |
| response (Required) | Object                   | -                                                       |
| chatBarRef          | Instance of `<ChatBar/>` | undefined                                               |
| supportsSuggestions | Boolean                  | true                                                    |
| processDrilldown    | Function                 | () => {}                                                |
| onSuggestionClick   | Function                 | undefined                                               |
| tableBorderColor    | String                   | undefined                                               |
| tableHoverColor     | String                   | undefined                                               |
| displayType         | String                   | undefined                                               |
| renderTooltips      | Boolean                  | true                                                    |
| currencyCode        | String                   | 'USD'                                                   |
| languageCode        | String                   | 'en-US'                                                 |
| currencyDecimals    | Number                   | 2                                                       |
| quantityDecimals    | Number                   | 1                                                       |
| comparisonDisplay   | String                   | 'ratio' &#124;&#124; 'percent'                          |
| fontFamily          | String                   | 'sans-serif'                                            |
| chartColors         | Array                    | ['#355C7D', '#6C5B7B', '#C06C84', '#f67280', '#F8B195'] |

#### Dashboard Props

| Prop                  | Type                  | Default Value                                           |
| :-------------------- | :-------------------- | :------------------------------------------------------ |
| token (Required)      | String                | -                                                       |
| apiKey (Required)     | String                | -                                                       |
| customerId (Required) | String                | -                                                       |
| userId (Required)     | String                | -                                                       |
| domain (Required)     | String                | -                                                       |
| tiles (Required)      | Array of Tile Objects | []                                                      |
| onChangeCallback      | Function              | () => {}                                                |
| isEditing             | Boolean               | false                                                   |
| currencyCode          | String                | 'USD'                                                   |
| languageCode          | String                | 'en-US'                                                 |
| currencyDecimals      | Number                | 2                                                       |
| quantityDecimals      | Number                | 1                                                       |
| comparisonDisplay     | String                | 'ratio' &#124;&#124; 'percent'                          |
| fontFamily            | String                | 'sans-serif'                                            |
| chartColors           | Array                 | ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'] |
| titleColor            | string                | '#2466AE'                                               |
| executeOnMount        | Boolean               | true                                                    |
| executeOnStopEditing  | Boolean               | true                                                    |
| notExecutedText       | String                | 'Hit "Execute" to run this dashboard'                   |
| demo                  | Boolean               | false                                                   |
| debug                 | Boolean               | false                                                   |

#### Prop Descriptions

**isVisible**: Whether the drawer is open or not. You have full control over the visibility of the drawer by using your own state.

**placement**: Which edge of the screen to place the drawer.

**width**: Set the drawer width in pixels. If the value is larger than the screen width, the screen width will be used. This value will only be applied for placements "left" and "right" only. The value will be ignored for "top" and "bottom" placements.

**height**: Set the drawer height in pixels. If the value is larger than the screen height, the screen height will be used. This value will only be applied for placements "top" and "bottom" only. The value will be ignored for "left" and "right" placements.

**title**: Text that appears in the header of the chat window. You must provide an empty string if you do not want text here, otherwise the default text will be used.

**showHandle**: Whether or not to show the handle. If you do not want to show the handle, you can use your own custom button and control the drawer with the isVisible prop.

**handleStyles**: Specify custom css styles for the handle. Must pass in a valid jsx css style object (ie. { backgroundColor: '#000000' }).

**clearOnClose**: Whether or not to clear all messages when the drawer is closed. The intro message will still show when you open the drawer again.

**maxMessages**: Maximum amount of messages to show in the drawer at one time. If a new message is added and you have reached the maximum, the oldest message will be erased. Any number smaller than 2 will be ignored.

**theme**: Color theme for the chat drawer. Currently there is a light theme and a dark theme. You can also change the accent colour with the accentColor prop in addition to changing the theme.

**accentColor**: Main accent color used in the chat drawer. This is the color of the header, speech-to-text button, and the request messages. The chart colours will not be affected by this.

**chartColors**: An array of colors for the chart themes starting with the most primary. You can pass in any valid css color format in here, however it is recommended that the color is opaque. ie. "#26A7E9", "rgb(111, 227, 142)", or "red". The charts will always use the colors in order from first to last. If the chart requires more colors than provided, it will repeat the colors provided.

**titleColor**: The color of the title for dashboard tiles.

**onVisibleChange**: Callback after the drawer closes or opens.

**onHandleClick**: Callback when drawer handle is clicked.

**showMask**: Whether or not to show the mask (grayed out overlay when the chat drawer is open).

**onMaskClick**: If showMask is true, this is the callback for when the mask is clicked.

**maskClosable**: If this value is set to true, the onHandleClick function will be called when the mask is clicked. If showMask is false, this prop will be ignored.

**shiftScreen**: Whether or not to shift the whole screen over when the drawer opens/closes.

**customerName**: Name used in the intro message (ie. "Hi Nikki! I am here..."). You can customize this value using names from your own database.

**introMessage**: Customize the intro message to use your own branded voice. The customerName prop will be ignored if this is provided.

**fontFamily**: Customize the font family to the provided font wherever possible. Accepts any css font family that is available, and if not it will default on sans-serif

**enableVoiceRecord**: Enables the speech to text button. Note that this feature is only available in Google Chrome. It will fail silently on other browsers.

**enableAutocomplete**: If this is enabled, you will see query suggestions as you type in the chat bar.

**autocompleteStyles**: Object with jsx css to style the auto-complete popup (ie. { borderRadius: '4px' }).

**enableSafetyNet**: If this is enabled, the query will first go through a "safetynet" endpoint. If chata detects that a label might be misspelled, suggestions for that label will be returned in a message.

For example: If you query 'How much money does Nikk owe me?', safetynet may detect that there is no label called 'Nikk', but there are labels called 'Nikki', and 'Nick' in your database. The message will then let you choose a different label and re-run the query.

If this value is false, the query will bypass the "safetynet" endpoint and be sent straight to the "query" endpoint.

**disableDrilldowns**: A new query will be sent when clicking on a table or chart element to "drill down" into the data. A new message will be sent to the user with more detailed data related to that clicked element. If this is true, nothing will happen when a table or chart element is clicked.

**demo**: If this value is true, the widget will use chata's demo Plumbing Co. as a data source.

**debug**: If this value is true, the generated SQL for your queries will show in the interpretation icon in the message toolbar.

**response (Required)**: This is the whole response object supplied from the query endpoint (or safetynet endpoint if enabled). You must pass in this whole object to the response renderer to process.

For more information on the structure of a query response, please visit the API reference page on the chata.io developer site https://chata.readme.io/reference/queries-1#query

**chatBarRef**: The ref of the ChatBar component. This is used for the case where the response has a list of suggestions. If the user clicks on a suggestion, the ChatBar component will know to submit that new query.

**supportsSuggestions**: If this is true, the response message can have a list of suggestions if the query is not understood. If it is false, there will be a general error message in its place.

**processDrilldown**: Function to be called when a table or chart element is clicked. The ChatDrawer uses the drilldown endpoint from the chata.io open API https://chata.readme.io/reference/queries-1#querydrilldown

**onSuggestionClick**: Function to be called when a button from a suggestion response is clicked. By default, the query will be submitted through the ChatBar component.

**tableBorderColor**: Custom color provided to the tables for the dividing lines and borders. Default is a medium gray.

**tableHoverColor**: Custom color provided to the tables for the rows on hover. Default is a medium-dark gray.

**displayType**: This is where you can pass in the type of visualization you want for the data. The full list of display types is below:

| Display Type         | Prop Value       | Description                                                                                                                                      |
| :------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Table                | `table`          | Displays array data in a regular table. (We use the Tabulator library)                                                                           |
| Pivot Table          | `pivot_table`    | Displays a multi-dimensional table, with the first column frozen                                                                                 |
| Bar Chart            | `bar`            | Ordinal data is on the y-axis, numerical data is on the x-axis, bars are horizontal. Will show a series for each column of data where applicable |
| Column Chart         | `column`         | Ordinal data is on the x-axis, numerical data is on the y-axis, bars are vertical. Will show a series for each column of data where applicable   |
| Line Chart           | `line`           | Ordinal data is on the x-axis, numerical data is on the y-axis. Will show a line series for each column of data where applicable                 |
| Stacked Bar Chart    | `stacked-bar`    | Bars will be split into categories and the width of each section will be based on the total for that category                                    |
| Stacked Column Chart | `stacked-column` | Columns will be split into categories and the height of each section will be based on the total for that category                                |
| Heat Map             | `heatmap`        | The position of the squares are based on the categories, and the opacity of the squares are based on the values                                  |
| Bubble Chart         | `bubble`         | The position of the bubbles are based on the categories, and the radius of the bubbles are based on the values                                   |

You must pass in a supported display type to the ResponseRenderer (see the Supported Display Types section below for more details). If an invalid display type or non-supported display type is passed in, it will default to a regular table.

**renderTooltips**: Whether or not to render tooltips for chart display types. When this value is true, each chart element will have a tooltip showing the ordinal title/value and numerical title/value.

**currencyCode**: If your data is not in USD, you can specify the currency code here and all tables and charts will show the default currency formatting for that code.

**currencyDecimals**: Number of decimals to display for currency data types.

**quantityDecimals**: Number of decimals to display for quantity data types.

> **Warning:**
> Setting a currency code does _not_ perform a currency conversion. It simply displays the number in the desired format.

**languageCode**: If the currency code from your country needs to use a language other than english in order to show symbols correctly, you can pass in a locale here. Visit https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NumberFormat for more details

**isEditing**: Toggles edit mode for the dashboard component. If edit mode is active, the user is able to resize, reorder, or delete a tile. They are also able to change the query, title, and visualization type.

**tiles**: Required prop to manage the state of the dashboard. Used along with **onChangeCallback** below to control the state of the dashboard. More details in the Tile section below on the structure of this prop.

**onChangeCallback**: Callback used to update your tile state in your own react component. See example below for how to control the state of the dashboard.

# Tiles

The defaultTileState prop should be an array of tile objects. This can either be created through the widget by using edit mode, or you can pass it in manually. The minimum required structure for a dashboard tile is as follows:

```
{
   key: '0', // unique id for each tile
   w: 3, // width of the tile. A value of 1 represents 1/12 of the container width. 12 is the maximum (full width)
   h: 2, // height of the tile. A value of 1 represents 60px
   x: 0, // x position of the tile (in same increments as w)
   y: 0, // y position of the tile (in same increments as h)
   query: 'total profit this month', // query to be used for the tile
   title: 'Profit - Current Month' // title to display in the tile outide of edit mode. If this isn't supplied, the query text will be used
}
```

> **This is a controlled component**
> Note: The dashboard component is a controlled component. It accepts a tiles prop and an onChange callback that are designed to work with each other using your own state. This makes it extremely easy to fetch/manage/store the current dashboard tile state.

If you want to persist the dashboard, simply store the tile array in your own database. See example below for how to manage the dashboards tile state:

```
import React, { Component, Fragment } from 'react'
import { Dashboard, getDashboardTileState } from 'react-chata';

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {
  state = {
    isEditingDashboard: false,
    tiles: [],
  }

  saveDashboard = () => {
     // Save tileState somewhere
     yourSaveEndpoint(this.state.tiles);
  }

  render = () => {
    return (
      <Fragment>
        <button
      	  onClick={() =>
            this.setState({
              isEditingDashboard: !this.state.isEditingDashboard
            })}
        >
          Toggle Edit
        </button>
        <button onClick={this.saveDashboard}>
          Save Dashboard
        </button>
        <Dashboard
          apiKey="your-api-key"
          customerId = "your-customer-id"
          userId = "your@email.com"
          domain = "https://yourdomain.com"

          tiles={this.state.tiles}
          onChangeCallback={tiles => this.setState(tiles)}
          ref={r => (this.dashboardRef = r)}
          isEditing={this.state.isEditingDashboard}
        />
      </Fragment>
    )
  }
}
```

> **You probably don't need the response!**
> When saving your dashboard tiles, it is likely that you don't need to save the query response, since the dashboard can be executed ad hoc. In this case, just exclude the queryResponse from the tile objects.

# Supported Display Types

Using the ref of ResponseRenderer, you can access the `supportedDisplayTypes` array that is stored in the component. These are display type options you can pass in as the displayType prop into the ResponseRenderer component.

```
import React, { Component } from 'react'
import { ResponseRenderer } from 'react-chata'

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {

...
  getSupportedDisplayTypes = () => {
    return this.responseRef.supportedDisplayTypes
  }

  render = () => {
    const displayType = this.getSupportedDisplayTypes().includes('bar') ? 'bar' : 'table'

    return (
      <ResponseRenderer
        ref={ref => this.responseRef = ref}
        response={this.state.response}
        displayType={displayType} // If you pass in an unsupported display type, it will use 'table' by default
      />
    )
  }
}
```

# Dashboard Edit Mode

**Points to note about dashboard edit mode: **

- Safetynet and suggestions are enabled only in edit mode. If outside of edit mode, the tile will display a general error message. The reason for this it that the query should be considered immutable outside of edit mode.

- To add a dashboard tile, you can call the "addTile" function from the dashboard ref. It will make a new tile and place it at the bottom of the dashboard with a default width and height of 6 and 5 respectively.

- To undo the previous action, you can call the "undo" function from the dashboard ref. This will only undo one previous action. Undoing a second time will "redo"

```
import React, { Component, Fragment } from 'react'
import { Dashboard, getDashboardTileState } from 'react-chata';

import 'react-chata/dist/chata.esm.css'

export default class App extends Component {
  state = {
    isEditingDashboard: true,
  }

  ...
  addTile = () => {
    if (this.state.isEditingDashboard ? this.dashboardRef) {
      this.dashboardRef.addTile()
    }
  }

  undo = () => {
    if (this.state.isEditingDashboard ? this.dashboardRef) {
      this.dashboardRef.undo()
    }
  }

  render = () => {
    return (
      <Fragment>
        <button onClick={this.addTile}>
          Add Tile
        </button>
        <button onClick={this.undo}>
          Undo
        </button>
        <Dashboard
          apiKey="your-api-key"
          customerId = "your-customer-id"
          userId = "your@email.com"
          domain = "https://yourdomain.com"

          ref={r => (this.dashboardRef = r)}
          isEditing={this.state.isEditingDashboard}
        />
      </Fragment>
    )
  }
}
```

# More Examples

```
import React, { Component } from 'react'
import { ChatDrawer } from 'react-chata'

import 'react-chata/dist/chata.esm.css'

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
