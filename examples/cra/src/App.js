import React, { Component, Fragment } from 'react'
import axios from 'axios'
import {
  ChatDrawer,
  ResponseRenderer,
  ChatBar,
  Dashboard,
  executeDashboard
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
  Select,
  Form,
  message,
  Icon
} from 'antd'

import locateLogo from './locate_logo.png'
import purefactsLogo from './purefacts_logo.png'

import 'antd/dist/antd.css'
import '@chata-ai/core/dist/chata.esm.css'
import './index.css'

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

export default class App extends Component {
  state = {
    currentPage: 'drawer',
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
    // lightAccentColor: '#28a8e0',
    lightAccentColor: '#2466AE',
    darkAccentColor: '#525252',
    maxMessages: 10,
    isEditing: false,
    demo: true,
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
    dashboardTiles: [
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
        query: 'profit by month ytd',
        displayType: 'line',
        title: 'Monthly YTD Profit'
      },
      {
        key: '5',
        w: 6,
        h: 5,
        x: 6,
        y: 2,
        query: 'profit by month last year',
        displayType: 'line',
        title: '2018 Monthly Profit'
      },
      {
        key: '6',
        w: 6,
        h: 5,
        x: 0,
        y: 7,
        query: 'profit by class this year',
        displayType: 'column',
        title: 'Total Profit by Class (2019)'
      },
      {
        key: '7',
        w: 6,
        h: 5,
        x: 6,
        y: 7,
        query: 'profit by customer this year',
        displayType: 'bar',
        title: 'Total Profit by Customer (2019)'
      },
      {
        key: '8',
        w: 6,
        h: 5,
        x: 0,
        y: 10,
        query: 'total profit by class by month ytd',
        displayType: 'stacked_column',
        title: 'Product Profitability'
      },
      {
        key: '9',
        w: 6,
        h: 5,
        x: 6,
        y: 12,
        query: 'total profit by customer by month ytd',
        displayType: 'heatmap',
        title: 'Customer Profitability'
      }
    ]
  }

  onLogin = async e => {
    e.preventDefault()

    try {
      const baseUrl = window.location.href.includes('prod')
        ? 'https://backend.chata.io'
        : 'https://backend-staging.chata.io'

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
      localStorage.setItem('loginToken', loginToken)

      // Use login token to get JWT token
      const jwtResponse = await axios.get(`${baseUrl}/api/v1/jwt`, {
        headers: {
          Authorization: `Bearer ${loginToken}`
        }
      })

      // Put jwt token into storage
      const jwtToken = jwtResponse.data
      localStorage.setItem('jwtToken', jwtToken)

      this.setState({ isAuthenticated: true, componentKey: uuid.v4() })

      return message.success(
        'Login Sucessful! Your token will be valid for 6 hours if you do not clear your cache.'
      )
    } catch (error) {
      console.error(error)
      // Clear tokens
      localStorage.setItem('loginToken', null)
      localStorage.setItem('jwtToken', null)
      this.setState({ isAuthenticated: false })
      return message.error('Login Unsuccessful. Check logs for details.')
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
          onChange={e => this.setState({ [propName]: e })}
        />
      </div>
    )
  }

  onSortChartColors = items => {
    this.setState({
      items: items
    })
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
        {this.state.isAuthenticated &&
          this.state.domain.includes('locate') &&
          this.createBooleanRadioGroup('Locate Demo', 'locateUiOverlay', [
            true,
            false
          ])}
        {
          // this.state.isAuthenticated &&
          // this.state.domain.includes('purefacts') &&
          // this.createBooleanRadioGroup('PureFacts Demo', 'purefactsUiOverlay', [
          //   true,
          //   false
          // ])
        }
        {!this.state.demo && (
          <Fragment>
            <h3>You must login to access data</h3>
            <Form onSubmit={this.onLogin}>
              <h4>Username</h4>
              <Input
                onChange={e => {
                  this.setState({ email: e.target.value })
                }}
                value={this.state.email}
              />
              <h4>Password</h4>
              <Input
                type="password"
                onChange={e => {
                  this.setState({ password: e.target.value })
                }}
                value={this.state.password}
              />
              <br />
              <Button type="primary" htmlType="submit">
                Login
              </Button>
            </Form>
            <Form onSubmit={e => e.preventDefault()}>
              <h4>API key *</h4>
              <Input
                name="api-key"
                onChange={e => {
                  this.setState({ apiKey: e.target.value })
                }}
                onBlur={e => localStorage.setItem('api-key', e.target.value)}
                value={this.state.apiKey}
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
              <h4>Username (email)</h4>
              <Input
                name="username"
                onChange={e => {
                  this.setState({ username: e.target.value })
                }}
                onBlur={e => localStorage.setItem('user-id', e.target.value)}
                value={this.state.username}
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
            </Form>
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

  renderChatDrawerPage = () => {
    let handleImage
    if (this.state.isAuthenticated && this.state.domain.includes('purefacts')) {
      handleImage = purefactsLogo
    } else if (
      this.state.isAuthenticated &&
      this.state.domain.includes('locate')
    ) {
      handleImage = locateLogo
    }

    const lightAccentColor =
      this.state.isAuthenticated && this.state.domain.includes('purefacts')
        ? '#253340'
        : this.state.lightAccentColor

    const darkAccentColor =
      this.state.isAuthenticated && this.state.domain.includes('purefacts')
        ? '#253340'
        : this.state.darkAccentColor

    return (
      <div className="test-page-container">
        {
          // this.renderChatBarAndResponse()
        }
        {this.renderPropOptions()}
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
          placement={this.state.placement}
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
            comparisonDisplay: this.state.comparisonDisplay
              ? 'PERCENT'
              : 'RATIO',
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
      </div>
    )
  }

  renderDashboardPage = () => {
    return (
      <div
        className="dashboard-container"
        style={{ width: '100%', height: 'auto' }}
      >
        <div
          className="dashboard-toolbar-container"
          style={{
            display: 'flex',
            justifyContent: 'center',
            background: '#fafafa',
            padding: '10px'
          }}
        >
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
        onClick={({ key }) => this.setState({ currentPage: key })}
        selectedKeys={[this.state.currentPage]}
        mode="horizontal"
      >
        <Menu.Item key="drawer">Chat Drawer</Menu.Item>
        <Menu.Item key="dashboard">Dashboard</Menu.Item>
      </Menu>
    )
  }

  render = () => {
    const { currentPage } = this.state

    let pageToRender = null
    switch (currentPage) {
      case 'drawer': {
        pageToRender = this.renderChatDrawerPage()
        break
      }
      case 'dashboard': {
        pageToRender = this.renderDashboardPage()
        break
      }
      default: {
        break
      }
    }

    return (
      <Fragment>
        {this.state.isAuthenticated &&
          this.state.domain.includes('locate') &&
          !this.state.demo && <div className="ui-overlay locate" />}
        {this.state.isAuthenticated &&
          this.state.domain.includes('purefacts') &&
          !this.state.demo && <div className="ui-overlay purefacts" />}
        {this.state.demo && <div className="ui-overlay qbo-demo" />}
        {
          // this.state.demo && <div className="ui-overlay sage-demo" />
        }
        {this.renderNavMenu()}
        {pageToRender}
      </Fragment>
    )
  }
}
