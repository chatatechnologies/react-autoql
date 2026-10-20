---
slug: /
title: Getting started
sidebar_position: 1
---

# Getting started

`react-autoql` is a library of React components for [AutoQL](https://chata.ai). They let your users ask questions of their data in plain language and see the answers as tables and charts.

:::note Draft
This site replaces the [readme.io docs](https://chata.readme.io/docs/autoql-react-widgets). The guides are still being written (AQLP-995). The prop tables on each component page are generated from the code and are already current.
:::

## Install

```bash
npm install react-autoql
```

Import the stylesheet once in your app:

```js
import 'react-autoql/dist/autoql.esm.css'
```

## Components

| Component | What it does |
| --- | --- |
| [Data Messenger](components/data-messenger) | A chat drawer where users ask questions and get answers as tables and charts. |
| [Dashboard](components/dashboard) | A grid of saved queries shown as tiles. |
| [Data Alerts](components/data-alerts) | Lets users view and manage their data alerts. |
| [Notification Icon](components/notification-icon) | A bell that shows how many unread notifications there are. |
| [Notification Feed](components/notification-feed) | The list of notifications sent by data alerts. |
| [Query Input](components/query-input) | A text box for asking a question, with autocomplete. |
| [Query Output](components/query-output) | Shows the answer to a question as a table or chart. |
