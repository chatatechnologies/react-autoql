import React, { Component, Fragment } from 'react'
import axios from 'axios'
import {
  DataMessenger,
  ResponseRenderer,
  ChatBar,
  Dashboard,
  executeDashboard,
  NotificationButton,
  NotificationList,
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
  Modal,
  Spin
} from 'antd'

import {
  ToolOutlined,
  CloseOutlined,
  MenuFoldOutlined,
  ReloadOutlined,
  StopOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RollbackOutlined,
  SaveOutlined
} from '@ant-design/icons'

import locateLogo from './locate_logo.png'
import purefactsLogo from './purefacts_logo.png'

import 'antd/dist/antd.css'
import '@chata-ai/core/dist/autoql.esm.css'
import './index.css'

const getStoredProp = name => {
  if (getBaseUrl() === 'https://backend-staging.chata.io') {
    return localStorage.getItem(`staging-${name}`)
  }

  return localStorage.getItem(name)
}

const setStoredProp = (name, value) => {
  if (getBaseUrl() === 'https://backend-staging.chata.io') {
    localStorage.setItem(`staging-${name}`, value)
  }

  localStorage.setItem(name, value)
}

const getBaseUrl = () => {
  return window.location.href.includes('prod')
    ? 'https://backend.chata.io'
    : 'https://backend-staging.chata.io'
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
  authTimer = undefined

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
    enableQueryValidation: true,
    enableDrilldowns: true,
    enableQueryInspirationTab: true,
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
    debug: true,
    test: true,
    demo: getStoredProp('demo') == 'true',
    apiKey: getStoredProp('api-key') || '',
    domain: getStoredProp('domain-url') || '',
    customerId: getStoredProp('customer-id') || '',
    userId: getStoredProp('user-id') || '',
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
    activeDashboardId: undefined
  }

  componentDidMount = () => {
    this.checkAuthentication().then(() => {
      this.fetchDashboard()
    })
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (prevState.demo !== this.state.demo) {
      this.fetchDashboard()
    }
  }

  componentWillUnmount = () => {
    if (this.authTimer) {
      clearTimeout(this.authTimer)
    }
  }

  getAuthProp = () => {
    return {
      token: getStoredProp('jwtToken'),
      apiKey: this.state.apiKey, // required if demo is false
      domain: this.state.domain,
      demo: this.state.demo
    }
  }

  getAutoQLConfigProp = () => {
    return {
      enableQueryValidation: this.state.enableQueryValidation,
      enableAutocomplete: this.state.enableAutocomplete,
      enableDrilldowns: this.state.enableDrilldowns,
      enableColumnEditor: this.state.enableColumnEditor,
      debug: this.state.debug,
      test: this.state.test
    }
  }

  getDataFormattingProp = () => {
    return {
      currencyCode: this.state.currencyCode,
      languageCode: this.state.languageCode,
      currencyDecimals: this.state.currencyDecimals,
      quantityDecimals: this.state.quantityDecimals,
      comparisonDisplay: this.state.comparisonDisplay ? 'PERCENT' : 'RATIO',
      monthYearFormat: this.state.monthFormat,
      dayMonthYearFormat: this.state.dayFormat
    }
  }

  getThemeConfigProp = () => {
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

    return {
      theme: this.state.theme,
      accentColor:
        this.state.theme === 'light' ? lightAccentColor : darkAccentColor,
      fontFamily: this.state.fontFamily,
      chartColors: this.state.chartColors,
      titleColor: this.state.dashboardTitleColor
    }
  }

  executeQuery = query => {
    const url = `${this.state.domain}/autoql/api/v1/query?key=${this.state.apiKey}`

    const data = {
      text: query,
      source: 'notification'
    }

    const token = getStoredProp('jwtToken')

    const config = {}
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      }
    }

    if (!this.state.apiKey || !this.state.domain) {
      return Promise.reject({ error: 'unauthenticated' })
    }

    return axios
      .post(url, data, config)
      .then(response => {
        if (response.data && typeof response.data === 'string') {
          return Promise.reject({ error: 'parse error' })
        }
        if (
          !response ||
          !response.data ||
          !response.data.data ||
          response.data.data.display_type !== 'data'
        ) {
          return Promise.reject()
        }
        return Promise.resolve(response)
      })
      .catch(error => {
        return Promise.reject(error)
      })
  }

  checkAuthentication = () => {
    const loginToken = getStoredProp('loginToken')
    if (loginToken) {
      return this.getJWT(loginToken)
    }
    this.setState({
      isAuthenticated: false
    })
    return Promise.reject()
  }

  fetchDashboard = async () => {
    this.setState({
      isFetchingDashboard: true
    })

    try {
      const jwtToken = getStoredProp('jwtToken')
      if (jwtToken && !this.state.demo) {
        const baseUrl = getBaseUrl()

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

  getJWT = async loginToken => {
    if (!loginToken) {
      throw new Error('Invalid Login Token')
    }

    const baseUrl = getBaseUrl()
    let url = `${baseUrl}/api/v1/jwt?user_id=${this.state.userId}&customer_id=${this.state.customerId}`

    // Use login token to get JWT token
    const jwtResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${loginToken}`
      }
    })

    // Put jwt token into storage
    const jwtToken = jwtResponse.data
    setStoredProp('jwtToken', jwtToken)

    if (this.authTimer) {
      clearTimeout(this.authTimer)
    }
    this.authTimer = setTimeout(() => {
      this.setState({
        isAuthenticated: false
      })
    }, 2.16e7)

    this.setState({
      isAuthenticated: true,
      componentKey: uuid.v4(),
      activeIntegrator: this.getActiveIntegrator()
    })

    return Promise.resolve()
  }

  onLogin = async () => {
    try {
      const baseUrl = getBaseUrl()

      // Login to get login token
      const loginFormData = new FormData()
      loginFormData.append('username', this.state.email)
      loginFormData.append('password', this.state.password)
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
      setStoredProp('loginToken', loginToken)

      await this.getJWT(loginToken)

      message.success('Login Sucessful!', 0.8)
      this.fetchDashboard()
    } catch (error) {
      console.error(error)
      // Clear tokens
      setStoredProp('loginToken', null)
      setStoredProp('jwtToken', null)
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
    } else if (domain.includes('nbccontest')) {
      return 'nb-comp'
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
            setStoredProp(propName, e)
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

  onError = error => {
    if (error && error.message) {
      message.error(`${error.message}`)
    }
  }

  saveDashboard = async () => {
    this.setState({
      isSavingDashboard: true
    })

    try {
      // const { tiles, domain, apiKey } = this.state

      const data = {
        user_id: this.state.userId,
        customer_id: this.state.customerId,
        username: this.state.username,
        name: this.state.activeDashboardName,
        data: this.state.dashboardTiles.map(tile => {
          return {
            ...tile,
            queryResponse: undefined
          }
        })
      }

      const baseUrl = getBaseUrl()

      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}`

      await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
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
          <CloseOutlined
            style={{ float: 'right', cursor: 'pointer', marginTop: '3px' }}
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

  renderAuthenticationForm = () => {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 }
    }
    const tailLayout = {
      wrapperCol: { offset: 8, span: 16 }
    }

    return (
      <Fragment>
        <Form
          {...layout}
          initialValues={{
            customerId: this.state.customerId,
            userId: this.state.userId,
            apiKey: this.state.apiKey,
            domain: this.state.domain
          }}
          style={{ marginTop: '20px' }}
          onFinish={this.onLogin}
          onFinishFailed={errorInfo => console.log('Failed:', errorInfo)}
        >
          <Form.Item
            label="Customer ID"
            name="customerId"
            rules={[
              { required: true, message: 'Please enter your customer ID' }
            ]}
          >
            <Input
              name="customer-id"
              onChange={e => {
                this.setState({ customerId: e.target.value })
              }}
              onBlur={e => setStoredProp('customer-id', e.target.value)}
              initialValue={this.state.customerId}
              value={this.state.customerId}
            />
          </Form.Item>
          <Form.Item
            label="User ID"
            name="userId"
            rules={[{ required: true, message: 'Please enter your user ID' }]}
          >
            <Input
              name="user-id"
              onChange={e => {
                this.setState({ userId: e.target.value })
              }}
              onBlur={e => setStoredProp('userid', e.target.value)}
              value={this.state.userId}
            />
          </Form.Item>
          <Form.Item
            label="API key"
            name="apiKey"
            rules={[{ required: true, message: 'Please enter your API key' }]}
          >
            <Input
              name="api-key"
              onChange={e => {
                this.setState({ apiKey: e.target.value })
              }}
              onBlur={e => setStoredProp('api-key', e.target.value)}
              value={this.state.apiKey}
            />
          </Form.Item>
          <Form.Item
            label="Domain URL"
            name="domain"
            rules={[
              { required: true, message: 'Please enter your domain URL' }
            ]}
          >
            <Input
              name="domain-url"
              onChange={e => {
                this.setState({ domain: e.target.value })
              }}
              onBlur={e => setStoredProp('domain-url', e.target.value)}
              value={this.state.domain}
            />
          </Form.Item>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input
              onChange={e => {
                this.setState({ email: e.target.value })
              }}
              value={this.state.email}
            />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input
              type="password"
              onChange={e => {
                this.setState({ password: e.target.value })
              }}
              value={this.state.password}
            />
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type="primary" htmlType="submit">
              Authenticate
            </Button>
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button
              type="default"
              onClick={() => {
                this.setState({
                  isAuthenticated: false,
                  dashboardTiles: undefined
                })
                setStoredProp('loginToken', undefined)
                setStoredProp('jwtToken', undefined)
                message.success('Successfully logged out')
              }}
            >
              Log Out
            </Button>
          </Form.Item>
        </Form>
      </Fragment>
    )
  }

  renderPropOptions = () => {
    return (
      <div>
        <h1>Authentication</h1>
        {this.createBooleanRadioGroup('Demo Data', 'demo', [true, false])}
        {!this.state.demo && this.renderAuthenticationForm()}
        {this.createBooleanRadioGroup('Show UI Overlay', 'uiOverlay', [
          true,
          false
        ])}
        <h1>Drawer Props</h1>
        <Button
          onClick={() => this.setState({ componentKey: uuid.v4() })}
          style={{ marginRight: '10px' }}
          icon={<ReloadOutlined />}
        >
          Reload Drawer
        </Button>
        <Button
          onClick={() => this.setState({ isVisible: true })}
          type="primary"
          icon={<MenuFoldOutlined />}
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
        <h4>Query Input Placeholder</h4>
        <Input
          type="text"
          onChange={e => {
            this.setState({ inputPlaceholder: e.target.value })
          }}
          value={this.state.inputPlaceholder}
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
        {this.createBooleanRadioGroup(
          'Enable Safety Net',
          'enableQueryValidation',
          [true, false]
        )}
        {this.createBooleanRadioGroup('Enable Drilldowns', 'enableDrilldowns', [
          true,
          false
        ])}
        {this.createBooleanRadioGroup(
          'Enable Query Inspiration Tab',
          'enableQueryInspirationTab',
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
          'Debug Mode - Show copy to SQL button in message toolbar',
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

  renderDataMessenger = () => {
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

    return (
      <DataMessenger
        authentication={this.getAuthProp()}
        autoQLConfig={this.getAutoQLConfigProp()}
        dataFormatting={this.getDataFormattingProp()}
        themeConfig={this.getThemeConfigProp()}
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
        enableVoiceRecord={this.state.enableVoiceRecord}
        clearOnClose={this.state.clearOnClose}
        width={this.state.width}
        height={this.state.height}
        title={this.state.title}
        maxMessages={this.state.maxMessages}
        handleImage={handleImage}
        enableQueryInspirationTab={this.state.enableQueryInspirationTab}
        onErrorCallback={this.onError}
        inputPlaceholder={this.state.inputPlaceholder}
        // inputStyles
        // autocompleteStyles
        // handleStyles={{ right: '25px' }}
      />
    )
  }

  renderDataMessengerPage = () => {
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
          authentication={this.getAuthProp()}
          autoQLConfig={this.getAutoQLConfigProp()}
          dataFormatting={this.getDataFormattingProp()}
          themeConfig={this.getThemeConfigProp()}
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
            icon={this.state.isEditing ? <StopOutlined /> : <EditOutlined />}
          >
            {this.state.isEditing ? 'Stop Editing' : 'Edit'}
          </Button>
          <Button
            onClick={() => executeDashboard(this.dashboardRef)}
            icon={<PlayCircleOutlined />}
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
              icon={<PlusOutlined />}
              style={{ marginLeft: '10px' }}
            >
              Add Tile
            </Button>
          )}
          {this.state.isEditing && (
            <Button
              onClick={() => this.dashboardRef && this.dashboardRef.undo()}
              type="primary"
              icon={<RollbackOutlined />}
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
              icon={<SaveOutlined />}
              style={{ marginLeft: '10px' }}
            >
              Save Dashboard
            </Button>
          )}
        </div>
        <Dashboard
          ref={ref => (this.dashboardRef = ref)}
          authentication={this.getAuthProp()}
          autoQLConfig={this.getAutoQLConfigProp()}
          dataFormatting={this.getDataFormattingProp()}
          themeConfig={this.getThemeConfigProp()}
          isEditing={this.state.isEditing}
          executeOnMount={this.state.runDashboardAutomatically}
          executeOnStopEditing={this.state.runDashboardAutomatically}
          tiles={this.state.dashboardTiles}
          notExecutedText='Hit "Execute" to run this dashboard'
          onChange={newTiles => {
            this.setState({ dashboardTiles: newTiles })
          }}
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
        {this.state.dashboardTiles && (
          <Menu.Item key="dashboard">
            <ChataIcon type="dashboard" /> Dashboard
          </Menu.Item>
        )}
        {
          // <Menu.Item key="chatbar">Chat Bar</Menu.Item>
        }
        {!this.state.demo &&
          this.state.isAuthenticated &&
          this.getActiveIntegrator() === 'nb-comp' && (
            <Menu.Item key="settings">Notification Settings</Menu.Item>
          )}
        {!this.state.demo &&
          this.state.isAuthenticated &&
          this.getActiveIntegrator() === 'nb-comp' && (
            <Menu.Item key="notifications">
              <NotificationButton
                ref={r => (this.notificationBadgeRef = r)}
                authentication={this.getAuthProp()}
                onNewNotification={() => {
                  // If a new notification is detected, refresh the list
                  if (
                    this.notificationListRef &&
                    this.state.currentPage === 'notifications'
                  ) {
                    this.notificationListRef.refreshNotifications()
                  }
                }}
                onErrorCallback={this.onError}
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

    this.executeQuery(notification.query)
      .then(response => {
        this.setState({
          activeNotificationContent: response,
          isFetchingNotificationContent: false
        })
      })
      .catch(error => {
        this.setState({
          activeNotificationContent: {
            error: 'Something went wrong with this query.'
          },
          isFetchingNotificationContent: false
        })
      })
    // .finally(response => {
    //   this.setState({
    //     activeNotificationContent: response,
    //     isFetchingNotificationContent: false
    //   })
    // })
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
    } else if (this.state.activeNotificationContent.error) {
      return this.state.activeNotificationContent.error
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
          authentication={this.getAuthProp()}
          onExpandCallback={this.fetchNotificationContent}
          onCollapseCallback={() => {
            this.setState({ currentNotificationContent: null })
          }}
          expandedContent={this.renderNotificationContent()}
        />
      </div>
    )
  }

  renderSettingsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 50px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto'
        }}
      >
        <NotificationSettings
          authentication={this.getAuthProp()}
          onErrorCallback={this.onError}
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
      <ToolOutlined style={{ fontSize: '75px', marginBottom: '20px' }} />
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
        pageToRender = this.renderDataMessengerPage()
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
      <div>
        {this.renderUIOverlay()}
        {this.renderNavMenu()}
        {this.renderDataMessenger()}
        {pageToRender}
      </div>
    )
  }
}
