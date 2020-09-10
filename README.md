<h1 align="center"><img src="public/autoql-logo.png" style="text-align: center; width: 400px"/></h1>
<h3 align="center"><b>React Components for AutoQL</b></h3>
<p align="center">
  <a href="https://badge.fury.io/js/react-autoql"><img src="https://badge.fury.io/js/react-autoql.svg" alt="npm latest version" height="20"></a>
  <a>
    <img alt="Circle CI" src="https://circleci.com/gh/chatatechnologies/react-autoql/tree/master.svg?style=shield">
  </a>
  <a href="https://snyk.io/test/github/chatatechnologies/react-autoql">
    <img alt="known vulnerabilities" src="https://snyk.io/test/github/chatatechnologies/react-autoql/master/badge.svg">
  </a>
</p>
<p align="center">
  <a href="https://github.com/semantic-release/semantic-release">
    <img alt="semantic-release" src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg">
  </a>
  <a href="http://commitizen.github.io/cz-cli/">
    <img alt="commitizen friendly" src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg">
  </a>
</p>

<!-- [![Coverage](coverage/badge.svg)]() -->

# Documentation

Full documentation can be found [here](https://chata.readme.io/docs/autoql-react-widgets)

# Demo

A live demo can be found [here](https://chata-ai-test-page-prod.herokuapp.com/)

# Components

### DataMessenger

Deliver the power of AutoQL to your users through Data Messenger, a state-of-the-art conversational interface you can easily build into your existing application.

<img src="public/data-messenger.png" width="400px">

### Dashboard

Democratize the data in your application and deliver extended reporting and analytics capabilities to all your users with Dashboards you can build and deploy in a snap.

<img src="public/dashboard.png" width="400px">

### QueryInput

Query Input is an input box component that can be placed anywhere in the DOM. The QueryInput component works together with the QueryOutput component to automatically handle certain interactions with the data.

<img src="public/query-input.png" width="400px">

### QueryOutput

Query Output is a data visualization widget that accepts the response from our API's query endpoint.

<img src="public/query-output.jpg" width="400px">

# Quick Start

Using npm:

```
$ npm install react-autoql
```

Using yarn:

```
$ yarn add react-autoql
```

Import the component and the stylesheet

```
import { DataMessenger } from 'react-autoql';

import 'react-autoql/dist/autoql.esm.css'
```

Render the component and control the visibility

```
export default class App extends Component {
  state = {
    isVisible: false
  }

  onHandleClick = () => {
    this.setState({
      isVisible: !this.state.isVisible
    })
  }

  render = () => {
    return (
      <DataMessenger
        isVisible={this.state.isVisible}
        onHandleClick={this.onHandleClick}
        authentication={{
          apiKey: "your-api-key"
          domain: "https://yourdomain.com"
          token: "yourToken"
        }}
      />
    )
  }
}
```
