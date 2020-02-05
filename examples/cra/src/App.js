import React, { Component, Fragment } from 'react'
import axios from 'axios'
import {
  ChatDrawer,
  ResponseRenderer,
  ChatBar,
  Dashboard,
  executeDashboard,
  NotificationButton,
  NotificationList,
  NotificationItem,
  NotificationSettings,
  Icon as ChataIcon
} from '@chata-ai/core'
import uuid from 'uuid'
import { sortable } from 'react-sortable'

import {
  Radio,
  Input,
  InputNumber,
  Switch,
  Button,
  Menu,
  Form,
  message,
  Icon,
  Modal,
  Spin
} from 'antd'

import locateLogo from './locate_logo.png'
import purefactsLogo from './purefacts_logo.png'

import 'antd/dist/antd.css'
import '@chata-ai/core/dist/chata.esm.css'
import './index.css'

import sampleNotifications from './sampleNotifications'

const sampleNotificationData = {
  data: {
    message: '',
    data: {
      columns: [
        {
          type: 'DATE',
          name: 'transaction__transaction_date__month',
          groupable: true,
          active: false
        },
        {
          type: 'DOLLAR_AMT',
          name: 'transaction___sum',
          groupable: false,
          active: false
        }
      ],
      display_type: 'data',
      rows: [
        [1527724800, 202.52],
        [1530316800, 221.55],
        [1532995200, 228.21],
        [1535673600, 252.14],
        [1538265600, 252.12],
        [1540944000, 299.05],
        [1543536000, 271.28],
        [1546214400, 297.41],
        [1548892800, 341.56],
        [1551312000, 241.74],
        [1553990400, 330.45],
        [1556582400, 444.06],
        [1559260800, 501.55],
        [1561852800, 621.61],
        [1564531200, 993.41],
        [1567209600, 891.82],
        [1569801600, 807.31],
        [1572480000, 920.89],
        [1575072000, 1504.98]
      ],
      sql: [
        'select distinct qbo57.txndatemonth transaction__transaction_date__month, sum(qbo57.hometotalamt) transaction___sum from transactions qbo57 group by qbo57.txndatemonth'
      ],
      query_id: 'q_BZV5JAS5Q4i0A2iqff5nnA',
      interpretation: 'total transactions by transaction month'
    },
    reference_id: '1.1.0'
  }
}

class Item extends React.Component {
  render() {
    return (
      <li
        style={{
          width: '200px',
          margin: '0 auto',
          listStyleType: 'none',
          padding: 0,
          cursor: 'pointer',
          border: '1px solid lightgray',
          borderRadius: '3px',
          paddingRight: '5px',
          marginBottom: '3px'
        }}
        {...this.props}
      >
        {this.props.children}
      </li>
    )
  }
}

const SortableItem = sortable(Item)

const demoDashboard = [
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
  {
    key: '2',
    w: 3,
    h: 2,
    x: 6,
    y: 0,
    query: 'total profit ytd',
    title: 'Profit - YTD'
  },
  {
    key: '3',
    w: 3,
    h: 2,
    x: 9,
    y: 0,
    query: 'last years profit',
    title: 'Profit - Previous Year'
  },
  {
    key: '4',
    w: 6,
    h: 5,
    x: 0,
    y: 2,
    query: 'profit by month last 6 months',
    displayType: 'line',
    title: 'Monthly Profit'
  },
  {
    key: '5',
    w: 6,
    h: 5,
    x: 6,
    y: 2,
    query: 'profit by month last year',
    displayType: 'line',
    title: '2019 Monthly Profit'
  },
  {
    key: '6',
    w: 6,
    h: 5,
    x: 0,
    y: 7,
    query: 'profit by class last year',
    displayType: 'column',
    title: 'Total Profit by Class (2019)'
  },
  {
    key: '7',
    w: 6,
    h: 5,
    x: 6,
    y: 7,
    query: 'profit by customer last year',
    displayType: 'column',
    title: 'Total Profit by Customer (2019)'
  },
  {
    key: '8',
    w: 6,
    h: 5,
    x: 0,
    y: 10,
    query: 'total profit by class by month last 6 months',
    displayType: 'heatmap',
    title: 'Product Profitability'
  },
  {
    key: '9',
    w: 6,
    h: 5,
    x: 6,
    y: 12,
    query: 'total profit by customer by month last 6 months',
    displayType: 'heatmap',
    title: 'Customer Profitability'
  }
]

export default class App extends Component {
  state = {
    maintenance: false,
    currentPage: 'drawer',
    isNewDashboardModalOpen: false,
    componentKey: uuid.v4(),
    isVisible: false,
    placement: 'right',
    showHandle: true,
    theme: 'light',
    response: null,
    showMask: true,
    shiftScreen: false,
    customerName: 'Nikki',
    introMessage: undefined,
    enableAutocomplete: true,
    enableSafetyNet: true,
    disableDrilldowns: false,
    enableQueryTipsTab: true,
    enableColumnEditor: true,
    enableVoiceRecord: true,
    dashboardTitleColor: '#2466AE',
    clearOnClose: false,
    height: 500,
    width: 550,
    title: 'Data Messenger',
    lightAccentColor: '#26a7df',
    // lightAccentColor: '#2466AE',
    darkAccentColor: '#525252',
    maxMessages: 10,
    isEditing: false,
    demo: localStorage.getItem('demo') == 'true',
    debug: true,
    test: true,
    apiKey: localStorage.getItem('api-key') || '',
    customerId: localStorage.getItem('customer-id') || '',
    domain: localStorage.getItem('domain-url') || '',
    username: localStorage.getItem('user-id') || '',
    userId: localStorage.getItem('userid') || '',
    currencyCode: 'USD',
    languageCode: 'en-US',
    currencyDecimals: undefined,
    quantityDecimals: undefined,
    fontFamily: 'sans-serif',
    runDashboardAutomatically: false,
    comparisonDisplay: true,
    chartColors: ['#355C7D', '#6C5B7B', '#C06C84', '#f67280', '#F8B195'],
    monthFormat: 'MMM YYYY',
    dayFormat: 'MMM DD, YYYY',
    dashboardTiles: undefined,
    activeDashboardId: undefined,
    notifications: [],
    notificationSettings: []
  }

  componentDidMount = () => {
    this.fetchDashboard()
    this.fetchNotifications()
    this.fetchNotificationSettings()
    this.checkAuthentication()
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.demo !== this.state.demo) {
      this.fetchDashboard()
    }
  }

  checkAuthentication = () => {
    const loginToken = localStorage.getItem('loginToken')
    this.getJWT(loginToken)
  }

  fetchDashboard = async () => {
    this.setState({
      isFetchingDashboard: true
    })

    try {
      const jwtToken = localStorage.getItem('jwtToken')
      if (jwtToken && !this.state.demo) {
        const baseUrl = window.location.href.includes('prod')
          ? 'https://backend.chata.io'
          : 'https://backend-staging.chata.io'

        const url = `${baseUrl}/api/v1/dashboards?key=${this.state.apiKey}`
        const dashboardResponse = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Integrator-Domain': this.state.domain
          }
        })

        this.setState({
          dashboardTiles: dashboardResponse.data[0].data,
          dashboardError: false,
          isFetchingDashboard: false,
          activeDashboardId: dashboardResponse.data[0].id,
          activeDashboardName: dashboardResponse.data[0].name
        })
      } else {
        // use demo endpoint if there is one
        this.setState({
          dashboardTiles: demoDashboard,
          dashboardError: false,
          isFetchingDashboard: false
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({
        dashboardTiles: undefined,
        dashboardError: true,
        isFetchingDashboard: false,
        activeDashboardId: null
      })
    }
  }

  fetchNotifications = () => {
    // insert axios call here
    const notifications = sampleNotifications
    this.setState({ notifications })
  }

  fetchNotificationSettings = () => {
    const notificationSettings = sampleNotifications
    this.setState({ notificationSettings })
  }

  getBaseUrl = () => {
    return window.location.href.includes('prod')
      ? 'https://backend.chata.io'
      : 'https://backend-staging.chata.io'
  }

  getJWT = async loginToken => {
    if (!loginToken) {
      throw new Error('Invalid Login Token')
    }

    const baseUrl = this.getBaseUrl()

    // Use login token to get JWT token
    const jwtResponse = await axios.get(
      `${baseUrl}/api/v1/jwt?user_id=${this.state.userId}&customer_id=${this.state.customerId}`,
      {
        headers: {
          Authorization: `Bearer ${loginToken}`
        }
      }
    )

    // Put jwt token into storage
    const jwtToken = jwtResponse.data
    localStorage.setItem('jwtToken', jwtToken)

    this.setState({
      isAuthenticated: true,
      componentKey: uuid.v4(),
      activeIntegrator: this.getActiveIntegrator()
    })
  }

  onLogin = async e => {
    if (e) {
      e.preventDefault()
    }

    try {
      const baseUrl = this.getBaseUrl()

      // Login to get login token
      const loginFormData = new FormData()
      loginFormData.append('username', this.state.email)
      loginFormData.append('password', this.state.password)
      // loginFormData.append('user_id', this.state.userId)
      // loginFormData.append('customer_id', this.state.customerId)
      const loginResponse = await axios.post(
        `${baseUrl}/api/v1/login`,
        loginFormData,
        {
          headers: {
            // 'Access-Control-Allow-Origin': '*'
          }
        }
      )

      // Put login token in local storage
      const loginToken = loginResponse.data
      localStorage.setItem('loginToken', loginToken)

      this.getJWT(loginToken)

      message.success('Login Sucessful!', 0.8)
      this.fetchDashboard()
    } catch (error) {
      console.error(error)
      // Clear tokens
      localStorage.setItem('loginToken', null)
      localStorage.setItem('jwtToken', null)
      this.setState({
        isAuthenticated: false,
        activeIntegrator: null,
        componentKey: uuid.v4()
      })

      // Dont fetch dashboard if authentication failed...
      // this.fetchDashboard()
      message.error('Login Unsuccessful. Check logs for details.')
    }
  }

  getActiveIntegrator = () => {
    const { domain } = this.state

    if (domain.includes('spira')) {
      return 'spira'
    } else if (domain.includes('locate')) {
      return 'locate'
    } else if (domain.includes('purefacts')) {
      return 'purefacts'
    } else if (domain.includes('bluelink')) {
      return 'bluelink'
    } else if (domain.includes('lefort')) {
      return 'lefort'
    }
  }

  createRadioInputGroup = (title, propName, propValues = []) => {
    return (
      <div>
        <h4>{title}</h4>
        <Radio.Group
          defaultValue={this.state[propName]}
          onChange={e => this.setState({ [propName]: e.target.value })}
          buttonStyle="solid"
        >
          {propValues.map(propValue => {
            return (
              <Radio.Button value={propValue} key={`${propName}-${propValue}`}>
                {propValue.toString()}
              </Radio.Button>
            )
          })}
        </Radio.Group>
      </div>
    )
  }

  createBooleanRadioGroup = (title, propName, propValues = []) => {
    return (
      <div>
        <h4>{title}</h4>
        <Switch
          defaultChecked={this.state[propName]}
          checked={this.state[propName] === true}
          onChange={e => {
            this.setState({ [propName]: e })
            localStorage.setItem(propName, e)
          }}
        />
      </div>
    )
  }

  onSortChartColors = items => {
    this.setState({
      items: items
    })
  }

  saveDashboard = async () => {
    this.setState({
      isSavingDashboard: true
    })

    try {
      // const { tiles, domain, apiKey } = this.state

      const data = {
        name: this.state.activeDashboardName,
        customer_id: this.state.customerId,
        user_id: this.state.userId,
        data: this.state.dashboardTiles.map(tile => {
          return {
            ...tile,
            queryResponse: undefined
          }
        })
      }

      const baseUrl = window.location.href.includes('prod')
        ? 'https://backend.chata.io'
        : 'https://backend-staging.chata.io'

      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}`

      await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
          'Integrator-Domain': this.state.domain
        }
      })

      this.setState({
        isSavingDashboard: false,
        isEditing: false
      })
    } catch (error) {
      console.error(error)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true
      })
    }
  }

  renderChartColorsList = () => {
    const { chartColors } = this.state
    var listItems = chartColors.map((item, i) => {
      return (
        <SortableItem
          key={i}
          onSortItems={this.onSortChartColors}
          items={chartColors}
          sortId={i}
        >
          {item}
          <Icon
            style={{ float: 'right', cursor: 'pointer', marginTop: '3px' }}
            type="close"
            onClick={() => {
              const newChartColors = this.state.chartColors.filter(
                color => color !== item
              )
              this.setState({ chartColors: newChartColors })
            }}
          />
        </SortableItem>
      )
    })

    return (
      <div>
        <ul
          style={{ padding: 0, marginBottom: '3px' }}
          className="sortable-list"
        >
          {listItems}
        </ul>
        <Input
          placeholder="New Color"
          value={this.state.newColorInput}
          onChange={e => this.setState({ newColorInput: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const newChartColors = [...this.state.chartColors, e.target.value]
              this.setState({ chartColors: newChartColors, newColorInput: '' })
            }
          }}
        />
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
              chatBarRef={this.chatBarRef}
              response={this.state.response}
              demo={this.state.demo}
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
        {this.createBooleanRadioGroup('Show UI Overlay', 'uiOverlay', [
          true,
          false
        ])}
        {!this.state.demo && (
          <Fragment>
            <h3>You must login to access data</h3>
            <Form onSubmit={this.onLogin}>
              <h4>Email (optional)</h4>
              <Input
                name="username"
                onChange={e => {
                  this.setState({ username: e.target.value })
                }}
                onBlur={e => localStorage.setItem('user-id', e.target.value)}
                value={this.state.username}
              />
              <h4>Customer ID *</h4>
              <Input
                name="customer-id"
                onChange={e => {
                  this.setState({ customerId: e.target.value })
                }}
                onBlur={e =>
                  localStorage.setItem('customer-id', e.target.value)
                }
                value={this.state.customerId}
              />
              <h4>User ID *</h4>
              <Input
                name="user-id"
                onChange={e => {
                  this.setState({ userId: e.target.value })
                }}
                onBlur={e => localStorage.setItem('userid', e.target.value)}
                value={this.state.userId}
              />
              <h4>API key *</h4>
              <Input
                name="api-key"
                onChange={e => {
                  this.setState({ apiKey: e.target.value })
                }}
                onBlur={e => localStorage.setItem('api-key', e.target.value)}
                value={this.state.apiKey}
              />

              <h4>Domain URL *</h4>
              <Input
                name="domain-url"
                onChange={e => {
                  this.setState({ domain: e.target.value })
                }}
                onBlur={e => localStorage.setItem('domain-url', e.target.value)}
                value={this.state.domain}
              />
              <h4>Username *</h4>
              <Input
                onChange={e => {
                  this.setState({ email: e.target.value })
                }}
                value={this.state.email}
              />
              <h4>Password *</h4>
              <Input
                type="password"
                onChange={e => {
                  this.setState({ password: e.target.value })
                }}
                value={this.state.password}
              />
              <br />
              <Button type="primary" htmlType="submit">
                Authenticate
              </Button>
            </Form>
            <Form onSubmit={e => e.preventDefault()}></Form>
          </Fragment>
        )}
        <h1>Drawer Props</h1>
        <Button
          onClick={() => this.setState({ componentKey: uuid.v4() })}
          style={{ marginRight: '10px' }}
          icon="reload"
        >
          Reload Drawer
        </Button>
        <Button
          onClick={() => this.setState({ isVisible: true })}
          type="primary"
          icon="menu-unfold"
        >
          Open Drawer
        </Button>
        {this.createBooleanRadioGroup('Show Drawer Handle', 'showHandle', [
          true,
          false
        ])}
        {this.createBooleanRadioGroup('Show Mask', 'showMask', [true, false])}
        {this.createBooleanRadioGroup(
          'Shift Screen on Open/Close',
          'shiftScreen',
          [true, false]
        )}
        {this.createRadioInputGroup('Theme', 'theme', ['light', 'dark'])}
        {this.createRadioInputGroup('Drawer Placement', 'placement', [
          'top',
          'bottom',
          'left',
          'right'
        ])}
        <h4>Currency Code</h4>
        <Input
          type="text"
          onBlur={e => {
            this.setState({ currencyCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.currencyCode}
        />
        <h4>Language Code</h4>
        <Input
          type="text"
          onBlur={e => {
            this.setState({ languageCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.languageCode}
        />
        <h4>Format for Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href="https://devhints.io/moment" target="_blank">
            View the cheat sheet
          </a>
        </h6>
        <Input
          type="text"
          onBlur={e => {
            this.setState({ monthFormat: e.target.value })
          }}
          defaultValue={this.state.monthFormat}
        />
        <h4>Format for Day, Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href="https://devhints.io/moment" target="_blank">
            View the cheat sheet
          </a>
        </h6>

        <Input
          type="text"
          onBlur={e => {
            this.setState({ dayFormat: e.target.value })
          }}
          defaultValue={this.state.dayFormat}
        />
        <h4>Number of Decimals for Currency Values</h4>
        <InputNumber
          type="number"
          onChange={e => {
            this.setState({ currencyDecimals: e })
          }}
          value={this.state.currencyDecimals}
        />
        <h4>Number of Decimals for Quantity Values</h4>
        <InputNumber
          type="number"
          onChange={e => {
            this.setState({ quantityDecimals: e })
          }}
          value={this.state.quantityDecimals}
        />
        <h4>Customer Name</h4>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="text"
          onChange={e => {
            this.setState({ customerName: e.target.value })
          }}
          value={this.state.customerName}
        />
        <h4>Intro Message</h4>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="text"
          onChange={e => {
            this.setState({ introMessage: e.target.value })
          }}
          value={this.state.introMessage}
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
            this.setState({ height: e })
          }}
          value={this.state.height}
        />
        <h4>Width</h4>
        <h5>Only for left/right placement</h5>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <InputNumber
          type="number"
          onChange={e => {
            this.setState({ width: e })
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
        <h4>Font Family</h4>
        <h6>(Must click 'Reload Drawer' to apply this)</h6>
        <Input
          type="text"
          onChange={e => {
            this.setState({ fontFamily: e.target.value })
          }}
          value={this.state.fontFamily}
        />
        <h4>Chart Colors</h4>
        <h5>
          This is an array of colors used for the charts. If the data scale is
          larger than the color array, it will repeat the colors. Any solid
          color formats are accepted. Hit "enter" to add a color.
        </h5>
        {this.renderChartColorsList()}
        {
          // <Select
          //   mode="tags"
          //   onChange={colors => {
          //     this.setState({ chartColors: colors })
          //   }}
          //   value={this.state.chartColors}
          // />
        }
        <h4>Dashboard Title Color</h4>
        <Input
          type="text"
          onChange={e => {
            this.setState({ dashboardTitleColor: e.target.value })
          }}
          value={this.state.dashboardTitleColor}
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
            this.setState({ maxMessages: e })
          }}
          value={this.state.maxMessages}
        />
        {this.createBooleanRadioGroup(
          'Display comparisons as Percent',
          'comparisonDisplay',
          [true, false]
        )}
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
          'Disable Drilldowns',
          'disableDrilldowns',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Query Inspiration Tab',
          'enableQueryTipsTab',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Column Visibility Editor',
          'enableColumnEditor',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Enable Speech to Text',
          'enableVoiceRecord',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Debug Mode (Shows SQL in the info tooltip)',
          'debug',
          [true, false]
        )}
        {this.createBooleanRadioGroup(
          'Test Mode (Provides extra logging on the server side)',
          'test',
          [true, false]
        )}
      </div>
    )
  }

  renderChatDrawer = () => {
    let handleImage
    if (
      this.state.isAuthenticated &&
      this.state.activeIntegrator === 'purefacts' &&
      !this.state.demo
    ) {
      handleImage = purefactsLogo
    } else if (
      this.state.isAuthenticated &&
      this.state.activeIntegrator === 'locate' &&
      !this.state.demo
    ) {
      handleImage = locateLogo
    }

    const lightAccentColor =
      this.state.isAuthenticated &&
      this.state.activeIntegrator === 'purefacts' &&
      !this.state.demo
        ? '#253340'
        : this.state.lightAccentColor

    const darkAccentColor =
      this.state.isAuthenticated &&
      this.state.activeIntegrator === 'purefacts' &&
      !this.state.demo
        ? '#253340'
        : this.state.darkAccentColor

    return (
      <ChatDrawer
        token={localStorage.getItem('jwtToken')}
        apiKey={this.state.apiKey} // required if demo is false
        customerId={this.state.customerId} // required if demo is false
        userId={this.state.userId} // required if demo is false
        domain={this.state.domain}
        username={this.state.username}
        key={this.state.componentKey}
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
        onMaskClick={() => this.setState({ isVisible: false })}
        showHandle={this.state.showHandle}
        placement={
          this.state.currentPage === 'drawer' ||
          this.state.currentPage === 'dashboard'
            ? this.state.placement
            : 'bottom'
        }
        customerName={this.state.customerName}
        introMessage={this.state.introMessage}
        showMask={this.state.showMask}
        shiftScreen={this.state.shiftScreen}
        enableAutocomplete={this.state.enableAutocomplete}
        enableVoiceRecord={this.state.enableVoiceRecord}
        clearOnClose={this.state.clearOnClose}
        width={this.state.width}
        height={this.state.height}
        title={this.state.title}
        enableSafetyNet={this.state.enableSafetyNet}
        disableDrilldowns={this.state.disableDrilldowns}
        theme={this.state.theme}
        accentColor={
          this.state.theme === 'light' ? lightAccentColor : darkAccentColor
        }
        fontFamily={this.state.fontFamily}
        maxMessages={this.state.maxMessages}
        demo={this.state.demo}
        debug={this.state.debug}
        test={this.state.test}
        dataFormatting={{
          currencyCode: this.state.currencyCode,
          languageCode: this.state.languageCode,
          currencyDecimals: this.state.currencyDecimals,
          quantityDecimals: this.state.quantityDecimals,
          comparisonDisplay: this.state.comparisonDisplay ? 'PERCENT' : 'RATIO',
          monthYearFormat: this.state.monthFormat,
          dayMonthYearFormat: this.state.dayFormat
        }}
        chartColors={this.state.chartColors}
        handleImage={handleImage}
        enableQueryTipsTab={this.state.enableQueryTipsTab}
        enableColumnEditor={this.state.enableColumnEditor}
        // inputStyles
        // autocompleteStyles
        // handleStyles={{ right: '25px' }}
      />
    )
  }

  renderChatDrawerPage = () => {
    return (
      <div className="test-page-container">
        {
          // this.renderChatBarAndResponse()
        }
        {this.renderPropOptions()}
      </div>
    )
  }

  renderChatBarPage = () => {
    return (
      <div>
        <ChatBar
          token={localStorage.getItem('jwtToken')}
          apiKey={this.state.apiKey} // required if demo is false
          customerId={this.state.customerId} // required if demo is false
          userId={this.state.userId} // required if demo is false
          domain={this.state.domain}
          username={this.state.username}
          demo={this.state.demo}
          ref={r => (this.chatBarRef = r)}
          autoCompletePlacement="bottom"
          onSubmit={() => this.setState({ response: null })}
          onResponseCallback={response => {
            this.setState({ response })
          }}
          showChataIcon
          showLoadingDots
        />
        {
          // this.state.response ? (
          <div
            style={{
              // height: 'auto',
              // minHeight: '100px',
              height: 'calc(100vh - 120px)',
              overflow: 'hidden',
              padding: '20px',
              paddingTop: '0',
              fontFamily: 'Helvetica, Arial, Sans-Serif', // Text, tables, and charts will inherit font
              color: '#565656' // Text, tables, and charts will inherit text color
            }}
          >
            <ResponseRenderer
              chatBarRef={this.chatBarRef}
              response={this.state.response}
              demo={this.state.demo}
            />
          </div>
          // ) : (
          //   <div
          //     style={{
          //       height: '75px',
          //       width: 'calc(100% - 60px)',
          //       padding: '30px',
          //       fontFamily: 'Helvetica, Arial, Sans-Serif',
          //       color: '#999',
          //       textAlign: 'center',
          //       fontSize: '14px'
          //     }}
          //   ></div>
          // )
        }
      </div>
    )
  }

  renderDashboardPage = () => {
    if (this.state.isFetchingDashboard) {
      return <Spin />
    }

    return (
      <div
        className="dashboard-container"
        style={{ width: '100%', height: 'auto' }}
      >
        <div
          className="dashboard-toolbar-container"
          style={{
            textAlign: 'center',
            background: '#fafafa',
            padding: '10px'
          }}
        >
          <div style={{ paddingTop: '6px', marginLeft: '10px' }}>
            Run Dashboard Automatically&nbsp;&nbsp;
            <Switch
              defaultChecked={this.state.runDashboardAutomatically}
              checked={this.state.runDashboardAutomatically === true}
              onChange={e => {
                if (e) {
                  executeDashboard(this.dashboardRef)
                }
                this.setState({ runDashboardAutomatically: e })
              }}
            />
          </div>
          {
            //   !this.state.isEditing && (
            //   <Button
            //     onClick={() => this.setState({ isNewDashboardModalOpen: true })}
            //     icon="plus"
            //   >
            //     New Dashboard
            //   </Button>
            // )
          }
          <Button
            onClick={() => this.setState({ isEditing: !this.state.isEditing })}
            icon={this.state.isEditing ? 'stop' : 'edit'}
          >
            {this.state.isEditing ? 'Stop Editing' : 'Edit'}
          </Button>
          <Button
            onClick={() => executeDashboard(this.dashboardRef)}
            icon="play-circle"
            style={{ marginLeft: '10px' }}
          >
            Execute Dashboard
          </Button>
          <Button
            onClick={() => console.log(this.state.dashboardTiles)}
            style={{ marginLeft: '10px' }}
          >
            Log Current Tile State
          </Button>

          <br />
          {this.state.isEditing && (
            <Button
              onClick={() => this.dashboardRef && this.dashboardRef.addTile()}
              type="primary"
              icon="plus"
              style={{ marginLeft: '10px' }}
            >
              Add Tile
            </Button>
          )}
          {this.state.isEditing && (
            <Button
              onClick={() => this.dashboardRef && this.dashboardRef.undo()}
              type="primary"
              icon="rollback"
              style={{ marginLeft: '10px' }}
            >
              Undo
            </Button>
          )}
          {this.state.isEditing && !this.state.demo && (
            <Button
              onClick={this.saveDashboard}
              loading={this.state.isSavingDashboard}
              type="primary"
              icon="save"
              style={{ marginLeft: '10px' }}
            >
              Save Dashboard
            </Button>
          )}
        </div>
        <Dashboard
          ref={ref => (this.dashboardRef = ref)}
          token={localStorage.getItem('jwtToken')}
          apiKey={this.state.apiKey} // required if demo is false
          customerId={this.state.customerId} // required if demo is false
          userId={this.state.userId} // required if demo is false
          username={this.state.username}
          domain={this.state.domain} // required if demo is false
          demo={this.state.demo}
          debug={this.state.debug}
          test={this.state.test}
          enableSafetyNet={this.state.enableSafetyNet}
          isEditing={this.state.isEditing}
          dataFormatting={{
            currencyCode: this.state.currencyCode,
            languageCode: this.state.languageCode,
            currencyDecimals: this.state.currencyDecimals,
            quantityDecimals: this.state.quantityDecimals,
            comparisonDisplay: this.state.comparisonDisplay
              ? 'PERCENT'
              : 'RATIO',
            monthYearFormat: this.state.monthFormat,
            dayMonthYearFormat: this.state.dayFormat
          }}
          fontFamily={this.state.fontFamily}
          executeOnMount={this.state.runDashboardAutomatically}
          executeOnStopEditing={this.state.runDashboardAutomatically}
          tiles={this.state.dashboardTiles}
          notExecutedText='Hit "Execute" to run this dashboard'
          chartColors={this.state.chartColors}
          titleColor={this.state.dashboardTitleColor}
          onChangeCallback={newTiles => {
            this.setState({ dashboardTiles: newTiles })
          }}
          enableSQLInput={false}
        />
      </div>
    )
  }

  renderNavMenu = () => {
    return (
      <Menu
        onClick={({ key }) => {
          this.setState({ currentPage: key })
          if (key === 'notifications' && this.notificationBadgeRef) {
            this.notificationBadgeRef.resetCount()
          }
        }}
        selectedKeys={[this.state.currentPage]}
        mode="horizontal"
      >
        <Menu.Item key="drawer">
          <ChataIcon type="chata-bubbles-outlined" />
          Chat Drawer
        </Menu.Item>
        <Menu.Item key="dashboard">
          <ChataIcon type="dashboard" /> Dashboard
        </Menu.Item>
        <Menu.Item key="chatbar">Chat Bar</Menu.Item>
        {!this.state.demo && this.state.isAuthenticated && (
          <Menu.Item key="settings">Notification Settings</Menu.Item>
        )}
        {!this.state.demo && this.state.isAuthenticated && (
          <Menu.Item key="notifications">
            <NotificationButton
              ref={r => (this.notificationBadgeRef = r)}
              apiKey={this.state.apiKey}
              userId={this.state.userId}
              customerId={this.state.customerId}
              token={localStorage.getItem('jwtToken')}
              domain={this.state.domain}
              username={this.state.username}
              onNewNotification={() => {
                // If a new notification is detected, refresh the list
                if (
                  this.notificationListRef &&
                  this.state.currentPage === 'notifications'
                ) {
                  this.notificationListRef.refreshNotifications()
                }
              }}
            />
          </Menu.Item>
        )}
      </Menu>
    )
  }

  renderNewDashboardModal = () => {
    return (
      <Modal
        visible={this.state.isNewDashboardModalOpen}
        onOk={() => {}}
        onCancel={() => {}}
        title="New Dashboard"
      >
        <Input
          placeholder="Dashboard Name"
          value={this.state.dashboardNameInput}
          onChange={e => this.setState({ dashboardNameInput: e.target.value })}
        />
      </Modal>
    )
  }

  fetchNotificationContent = notification => {
    this.setState({
      activeNotificationContent: null,
      isFetchingNotificationContent: true
    })

    setTimeout(() => {
      this.setState({
        activeNotificationContent: sampleNotificationData,
        isFetchingNotificationContent: false
      })
    }, 1000)
  }

  renderNotificationContent = notification => {
    if (this.state.isFetchingNotificationContent) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            justifyContent: 'center'
          }}
        >
          <Spin />
        </div>
      )
    } else if (!this.state.activeNotificationContent) {
      return 'No data available'
    }

    return (
      <ResponseRenderer
        response={this.state.activeNotificationContent}
        displayType="column"
      />
    )
  }

  renderNotificationsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 50px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto'
        }}
      >
        <NotificationList
          ref={ref => (this.notificationListRef = ref)}
          apiKey={this.state.apiKey}
          userId={this.state.userId}
          customerId={this.state.customerId}
          token={localStorage.getItem('jwtToken')}
          domain={this.state.domain}
          username={this.state.username}
          // notifications={this.state.notifications}
          onExpandCallback={this.fetchNotificationContent}
          onCollapseCallback={() => {
            this.setState({ currentNotificationContent: null })
          }}
          // expandedContent={this.renderNotificationContent()}
        />
      </div>
    )
  }

  renderSettingsPage = () => {
    return (
      // <div
      //   style={{
      //     minHeight: '100%',
      //     padding: '50px',
      //     color: 'gray',
      //     fontStyle: 'italic',
      //     textAlign: 'center'
      //   }}
      // >
      //   <div style={{ fontSize: '20px' }}>Coming Soon!</div>
      //   <br /> You will be able to add and edit your custom notifications here.
      //   Visit{' '}
      //   <a
      //     target="_blank"
      //     href="https://balsamiq.cloud/stp154f/p7k5dww/r4C03?f=N4IgUiBcAMA0IDkpxAYWfAMhkAhHAsjgFo4DSUA2gLoC%2BQA%3D"
      //   >
      //     here
      //   </a>{' '}
      //   for a WIP wireframe
      // </div>
      <div
        style={{
          height: 'calc(100vh - 50px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto'
        }}
      >
        <NotificationSettings
          apiKey={this.state.apiKey}
          userId={this.state.userId}
          customerId={this.state.customerId}
          token={localStorage.getItem('jwtToken')}
          domain={this.state.domain}
          username={this.state.username}
        />
      </div>
    )
  }

  renderUIOverlay = () => {
    // Only render overlay if drawer is active and prop is enabled
    if (!this.state.uiOverlay || this.state.currentPage !== 'drawer') {
      return null
    }

    // Use QBO for demo project
    if (this.state.demo) {
      return <div className="ui-overlay qbo-demo" />
      // this.state.demo && <div className="ui-overlay sage-demo" />
    }

    // If using custom integrator but not authenticated
    if (!this.state.demo && !this.state.isAuthenticated) {
      return null
    }

    // Locate
    if (this.state.activeIntegrator === 'locate') {
      return <div className="ui-overlay locate" />
    }

    // Purefacts
    if (this.state.activeIntegrator === 'purefacts') {
      return <div className="ui-overlay purefacts" />
    }
  }

  renderMaintenancePage = () => (
    <div
      style={{
        margin: '0 auto',
        width: '300px',
        textAlign: 'center',
        paddingTop: '111px'
      }}
    >
      <Icon type="tool" style={{ fontSize: '75px', marginBottom: '20px' }} />
      <br />
      <div style={{ fontSize: '25px' }}>
        We're undergoing a bit of scheduled maintenance.
      </div>
      <hr style={{ margin: '25px 0px' }} />
      <div>
        Sorry for the inconvenience. We will be back up and running as soon as
        possible.
      </div>
    </div>
  )

  render = () => {
    if (this.state.maintenance) {
      return this.renderMaintenancePage()
    }

    const { currentPage } = this.state

    let pageToRender = null
    switch (currentPage) {
      case 'drawer': {
        pageToRender = this.renderChatDrawerPage()
        break
      }
      case 'chatbar': {
        pageToRender = this.renderChatBarPage()
        break
      }
      case 'dashboard': {
        pageToRender = this.renderDashboardPage()
        break
      }
      case 'notifications': {
        pageToRender = this.renderNotificationsPage()
        break
      }
      case 'settings': {
        pageToRender = this.renderSettingsPage()
        break
      }
      default: {
        break
      }
    }

    return (
      <Fragment>
        {this.renderUIOverlay()}
        {this.renderNavMenu()}
        {this.renderChatDrawer()}
        {pageToRender}
      </Fragment>
    )
  }
}
