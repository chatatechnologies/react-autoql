import React, { Component, Fragment } from 'react'
import axios from 'axios'
import { get, sortBy, isEqual, cloneDeep } from 'lodash'
import {
  DataMessenger,
  QueryOutput,
  QueryInput,
  Dashboard,
  executeDashboard,
  unExecuteDashboard,
  NotificationIcon,
  NotificationFeed,
  DataAlerts,
  Icon as ChataIcon,
  configureTheme,
} from 'react-autoql'

import { v4 as uuid } from 'uuid'
import { sortable } from 'react-sortable'

import { Radio, Input, InputNumber, Switch, Button, Menu, Form, message, Modal, Spin, Select } from 'antd'

import {
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  MenuFoldOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons'

import SentimentAnalysisPage from './SentimentAnalysisPage'
import SpeechToTextPage from './SpeechToTextPage'

import 'antd/dist/antd.css'
import 'react-autoql/dist/autoql.esm.css'
import './index.css'

const getStoredProp = (name) => {
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

const isProd = () => {
  return window.location.href.includes('prod')
}

const getBaseUrl = () => {
  return isProd() ? 'https://backend.chata.io' : 'https://backend-staging.chata.io'
}

class Item extends React.Component {
  render() {
    return (
      <li
        style={{
          margin: '0 auto',
          width: '200px',
          listStyleType: 'none',
          padding: 0,
          cursor: 'pointer',
          border: '1px solid lightgray',
          borderRadius: '3px',
          paddingRight: '5px',
          marginBottom: '3px',
        }}
        {...this.props}
      >
        {this.props.item}
      </li>
    )
  }
}

const SortableItem = sortable(Item)

export default class App extends Component {
  authTimer = undefined

  state = {
    pagination: true,
    maintenance: false,
    currentPage: 'chatbar', // 'drawer'
    isNewDashboardModalOpen: false,
    componentKey: uuid(),
    placement: 'right',
    showHandle: true,
    theme: 'light',
    response: {
      data: {
        data: {
          persistent_locked_conditions: [],
          columns: [
            {
              multi_series: false,
              dow_style: 'ALPHA_MON',
              precision: 'DAY',
              is_visible: true,
              name: 'util_volume.partition_datetime',
              groupable: false,
              type: 'DATE',
              display_name: 'Date',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.cmts_md_if_index',
              groupable: false,
              type: 'STRING',
              display_name: 'MAC Domain',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'topology_modified.node',
              groupable: false,
              type: 'STRING',
              display_name: 'Node',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.cmts_host_name',
              groupable: false,
              type: 'STRING',
              display_name: 'CMTS',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'topology_modified.hub',
              groupable: false,
              type: 'STRING',
              display_name: 'Hub',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'topology_modified.city',
              groupable: false,
              type: 'STRING',
              display_name: 'City',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'topology_modified.system',
              groupable: false,
              type: 'STRING',
              display_name: 'System',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'topology_modified.province',
              groupable: false,
              type: 'STRING',
              display_name: 'Province',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'wireline_data.sg_modem_received_power_levels.avg_receive_level',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'Average Receive Level (dBmV)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.avg_snr',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'Average SNR (dB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ds_scqam_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM DS Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ds_ofdm_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDM DS Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ds_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'DS Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.us_scqam_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM US Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.us_ofdma_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDMA US Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.us_volume_tb',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'US Traffic (TB)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.unerrored_codewords',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'Unerrored Codewords',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.correctable_codewords',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'Correctable Codewords',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.percentage_correctable',
              groupable: false,
              type: 'PERCENT',
              display_name: 'Percent Correctable',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.uncorrectable_codewords',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'Uncorrectable Codewords',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'codewords.percentage_uncorrectable',
              groupable: false,
              type: 'PERCENT',
              display_name: 'Percent Uncorrectable',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.scqam_ds_util_percent',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM DS Utilization (95th)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ofdm_ds_util_percent',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDM DS Utilization (95th)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.scqam_us_util_percent',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM US Utilization (95th)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ofdma_us_util_percent',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDMA US Utilization (95th)',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.scqam_ds_rop',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM DS ROP',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ofdm_ds_rop',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDM DS ROP',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.scqam_us_rop',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'SCQAM US ROP',
            },
            {
              multi_series: false,
              dow_style: '',
              precision: '',
              is_visible: true,
              name: 'util_volume.ofdma_us_rop',
              groupable: false,
              type: 'QUANTITY',
              display_name: 'OFDMA US ROP',
            },
          ],
          fe_req: {
            filters: [],
            orders: [],
            debug: false,
            source: 'data_messenger',
            page_size: 50,
            session_locked_conditions: {},
            date_format: 'ISO8601',
            session_filter_conditions: [],
            test: false,
            chart_images: 'exclude',
            translation: 'include',
            disambiguation: [],
            v2_dates: 0,
            text: 'all traffic last week in cgdt',
          },
          session_locked_conditions: [],
          sql: [
            "select util_volume.partition_datetime, util_volume.cmts_md_if_index, topology_modified.node, util_volume.cmts_host_name, topology_modified.hub, topology_modified.city, topology_modified.system, topology_modified.province, wireline_data.sg_modem_received_power_levels.avg_receive_level, codewords.avg_snr, util_volume.ds_scqam_volume_tb, util_volume.ds_ofdm_volume_tb, util_volume.ds_volume_tb, util_volume.us_scqam_volume_tb, util_volume.us_ofdma_volume_tb, util_volume.us_volume_tb, codewords.unerrored_codewords, codewords.correctable_codewords, codewords.percentage_correctable, codewords.uncorrectable_codewords, codewords.percentage_uncorrectable, util_volume.scqam_ds_util_percent, util_volume.ofdm_ds_util_percent, util_volume.scqam_us_util_percent, util_volume.ofdma_us_util_percent, util_volume.scqam_ds_rop, util_volume.ofdm_ds_rop, util_volume.scqam_us_rop, util_volume.ofdma_us_rop from (select wireline_data.sg_ds_us_congestion_15min.partition_datetime, wireline_data.sg_ds_us_congestion_15min.cmts_host_name, wireline_data.sg_ds_us_congestion_15min.cmts_md_if_index, wireline_data.sg_ds_us_congestion_15min.ds_scqam_volume_pb * 1000 as ds_scqam_volume_tb, wireline_data.sg_ds_us_congestion_15min.ds_ofdm_volume_pb * 1000 as ds_ofdm_volume_tb, wireline_data.sg_ds_us_congestion_15min.ds_total_volume_pb * 1000 as ds_volume_tb, wireline_data.sg_ds_us_congestion_15min.us_scqam_volume_pb * 1000 as us_scqam_volume_tb, wireline_data.sg_ds_us_congestion_15min.us_ofdma_volume_pb * 1000 as us_ofdma_volume_tb, wireline_data.sg_ds_us_congestion_15min.us_total_volume_pb * 1000 as us_volume_tb, wireline_data.sg_ds_us_congestion_15min.scqam_ds_util_index_percentage_95 * 100 as scqam_ds_util_percent, wireline_data.sg_ds_us_congestion_15min.ofdm_ds_util_index_percentage_95 * 100 as ofdm_ds_util_percent, wireline_data.sg_ds_us_congestion_15min.scqam_us_util_index_percentage_95 * 100 as scqam_us_util_percent, wireline_data.sg_ds_us_congestion_15min.ofdma_us_util_index_percentage_95 * 100 as ofdma_us_util_percent, case when wireline_data.sg_ds_us_congestion_15min.ofdm_ds_util_index_percentage_95 > 0.95 or wireline_data.sg_ds_us_congestion_15min.ofdma_us_util_index_percentage_95 > 0.95 or wireline_data.sg_ds_us_congestion_15min.scqam_ds_util_index_percentage_95 > 0.75 or wireline_data.sg_ds_us_congestion_15min.scqam_us_util_index_percentage_95 > 0.80 then 'congested' else 'uncongested' end as congestion_status, wireline_data.sg_ds_us_congestion_15min.scqam_ds_rop, wireline_data.sg_ds_us_congestion_15min.ofdm_ds_rop, wireline_data.sg_ds_us_congestion_15min.scqam_us_rop, wireline_data.sg_ds_us_congestion_15min.ofdma_us_rop from wireline_data.sg_ds_us_congestion_15min) as util_volume left join (select wireline_data.sg_access_network_topology.date, wireline_data.sg_access_network_topology.cmts_md_if_index, wireline_data.sg_access_network_topology.cmts_host_name, wireline_data.sg_access_network_topology.node, wireline_data.sg_access_network_topology.hub, wireline_data.sg_access_network_topology.system, split_part(wireline_data.sg_access_network_topology.city, '_', 1) as city, wireline_data.sg_access_network_topology.province, wireline_data.sg_access_network_topology.partition_datetime from wireline_data.sg_access_network_topology) as topology_modified on util_volume.cmts_md_if_index = topology_modified.cmts_md_if_index and util_volume.partition_datetime = topology_modified.partition_datetime left join (select wireline_data.sg_codewords_snr.partition_datetime, wireline_data.sg_codewords_snr.cmts_host_name, wireline_data.sg_codewords_snr.cmts_md_if_index, wireline_data.sg_codewords_snr.avg_snr, wireline_data.sg_codewords_snr.unerrored_codewords, wireline_data.sg_codewords_snr.correctable_codewords, wireline_data.sg_codewords_snr.uncorrectable_codewords, wireline_data.sg_codewords_snr.correctable_codewords / (wireline_data.sg_codewords_snr.unerrored_codewords + wireline_data.sg_codewords_snr.correctable_codewords + wireline_data.sg_codewords_snr.uncorrectable_codewords) * 100 as percentage_correctable, wireline_data.sg_codewords_snr.uncorrectable_codewords / (wireline_data.sg_codewords_snr.unerrored_codewords + wireline_data.sg_codewords_snr.correctable_codewords + wireline_data.sg_codewords_snr.uncorrectable_codewords) * 100 as percentage_uncorrectable from wireline_data.sg_codewords_snr where wireline_data.sg_codewords_snr.unerrored_codewords + wireline_data.sg_codewords_snr.correctable_codewords + wireline_data.sg_codewords_snr.uncorrectable_codewords > 0) as codewords on topology_modified.cmts_md_if_index = codewords.cmts_md_if_index and topology_modified.partition_datetime = codewords.partition_datetime left join wireline_data.sg_modem_received_power_levels on codewords.cmts_md_if_index = wireline_data.sg_modem_received_power_levels.cmts_md_if_index and codewords.partition_datetime = wireline_data.sg_modem_received_power_levels.partition_datetime where topology_modified.hub = 'CGDT' and util_volume.partition_datetime between from_iso8601_timestamp('2023-01-22T00:00:00.000Z') and from_iso8601_timestamp('2023-01-28T23:59:59.000Z') order by util_volume.partition_datetime desc limit 51",
          ],
          condition_filter: [],
          query_id: 'q_fPnZnNc3RjasUL0DBy0g1Q',
          parsed_interpretation: [
            {
              eng: 'all',
              c_type: 'PREFIX',
            },
            {
              eng: 'mac domains',
              c_type: 'SEED',
            },
            {
              eng: "'CGDT' (Hub)",
              c_type: 'FILTER',
            },
            {
              eng: ',',
              c_type: 'DELIM',
            },
            {
              eng: 'between 2023-01-22T00:00:00.000Z and 2023-01-28T23:59:59.000Z (Date)',
              c_type: 'FILTER',
            },
          ],
          chart_images: null,
          interpretation:
            "all mac domains 'CGDT' (Hub), between 2023-01-22T00:00:00.000Z and 2023-01-28T23:59:59.000Z (Date)",
          text: 'all traffic last week in cgdt',
          display_type: 'data',
          row_limit: 50,
          count_rows: 1050,
          rows: [
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '1085XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '4734XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '1042XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-86',
              'CG157C',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '-0.330499657418504',
              '36.9',
              '0.28349047553444245',
              '0.43746644272091306',
              '0.7209569182553558',
              '0.13082214608273193',
              '0.1423949100465283',
              '0.2732170561292602',
              '8.98779023E8',
              '6127.0',
              '6.816856869193296E-4',
              '16177.0',
              '0.0017998415794506278',
              '2.5991874426118824',
              '5.696462709100205',
              '13.455938394444445',
              '11.323379266421119',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XB5',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '671XA8',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '4675XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-87',
              'CG157D',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '-1.94537469913116',
              '37.5',
              '0.22466818044630804',
              '0.17842825754232905',
              '0.40309643798863715',
              '0.5586084488906627',
              '0.5575798234991323',
              '1.1161882723897956',
              '2.994745279E9',
              '67.0',
              '2.2372518381658462E-6',
              '210.0',
              '7.012281880818325E-6',
              '1.7185109346064813',
              '2.233392384969325',
              '74.10924745',
              '51.17069256445672',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '434XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-40',
              'CG154A',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '0.871916276193039',
              '36.0',
              '0.7811495856357988',
              '1.4911987163346296',
              '2.2723483019704287',
              '0.10511765111687058',
              '0.07501584908253814',
              '0.1801335001994086',
              '7.17602629E8',
              '238822.0',
              '0.0332658703825786',
              '77537.0',
              '0.010800243662032798',
              '6.748522513020834',
              '15.390582820552149',
              '12.235760366666668',
              '7.011581081184777',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC7',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '223XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '671XA9',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC3',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-13',
              'CG159A',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '-7.78272194935725',
              '37.8',
              '0.15082508148411833',
              '0.007857881165751477',
              '0.1586829626498698',
              '0.0034714377505906664',
              '1.887972245206982E-4',
              '0.003660234975111366',
              '2.9897611E7',
              '9.0',
              '3.0102730585243907E-5',
              '0.0',
              '0.0',
              '1.0894283974729937',
              '0.17483736145194273',
              '0.5028646444444443',
              '0.01727557550644567',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '1091XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-28',
              'CG1482',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '3.73664765160948',
              '36.9',
              '0.6455419928907971',
              '0.8465767026832881',
              '1.4921186955740846',
              '0.05561130411502194',
              '0.03390924882551441',
              '0.08952055294053629',
              '4.0661607E8',
              '1359.0',
              '3.342204028128077E-4',
              '476.0',
              '1.1706321687924686E-4',
              '6.1643334775270056',
              '9.719105102249488',
              '5.061534216666666',
              '3.522110508747698',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC5',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '223XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3915XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-44',
              'CG1474',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '4.0613442112603',
              '36.3',
              '0.6159821347395675',
              '1.2966426829674746',
              '1.9126248177070424',
              '0.06874730386297045',
              '0.0375312084277546',
              '0.10627851229072503',
              '4.8592645E8',
              '630299.0',
              '0.1295423374379404',
              '1555.0',
              '3.195917091983287E-4',
              '5.346567092013889',
              '14.699545095092025',
              '11.367806355555555',
              '6.577166540055249',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '4547XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '651XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC6',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XB2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '2434XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '1091XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '435XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '435XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-20',
              'CG160C',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '-0.903465712640577',
              '38.0',
              '0.15029215965745027',
              '0.20901995822830707',
              '0.3593121178857571',
              '0.11586128032314846',
              '0.0266822697270186',
              '0.14254355005016706',
              '6.41669156E8',
              '2.0',
              '3.116870821030122E-7',
              '40.0',
              '6.233741642060244E-6',
              '0.9613950091628086',
              '2.056047485173824',
              '9.627809977777778',
              '2.9914928560466545',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '434XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-34',
              'CG1221',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '1.87057423369615',
              '37.1',
              '1.4301664625970825',
              '1.880206638156245',
              '3.3103731007533277',
              '0.1609002903746326',
              '0.19776667669502143',
              '0.3586669670696542',
              '1.109492156E9',
              '772667.0',
              '0.06959205711236688',
              '15620.0',
              '0.001406851764207829',
              '14.582049082754628',
              '19.54846796523517',
              '20.06490688888889',
              '18.471586375844076',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XC4',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '2434XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3915XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-96',
              'CG10',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '4.81395318438497',
              '37.7',
              '0.16259339090107783',
              '0.019908416308833665',
              '0.18250180720991158',
              '0.0022085854145537103',
              '9.018851998554563E-5',
              '0.002298773934539255',
              '2.3482145E7',
              '8.0',
              '3.4068411840936455E-5',
              '10.0',
              '4.258551480117057E-5',
              '1.1429567881944445',
              '0.3296183895705521',
              '0.23811282777777776',
              '0.008298200583179864',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '2893XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '2434XA3',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XB6',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '3783XB1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '671XA7',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '4734XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '651XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-71',
              'CG1278',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '2.23611351495891',
              '37.3',
              '0.3358088950111692',
              '0.6711520387847614',
              '1.0069609337959309',
              '0.03067626242359013',
              '0.012192514864395322',
              '0.04286877728798544',
              '2.32271773E8',
              '200832.0',
              '0.08638881636481684',
              '1931.0',
              '8.306286069971981E-4',
              '3.061170088734568',
              '7.372905986196318',
              '5.232541911111111',
              '1.6705052179251074',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '1085XA2',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-54',
              '964XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '6.49764422483933',
              '38.5',
              '0.042578751594524185',
              '0.0',
              '0.042578751594524185',
              '6.324084922404438E-5',
              '0.0',
              '6.324084922404438E-5',
              '1192668.0',
              '13.0',
              '0.001089976741573222',
              '5.0',
              '4.1922182368200856E-4',
              '1.5780033333333332',
              0,
              '0.0814332',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX6-56',
              '4675XA1',
              'DX6DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '8.51050462891498',
              '37.0',
              '0.0930628002160372',
              '0.0',
              '0.0930628002160372',
              '0.0011409866684797267',
              '0.0',
              '0.0011409866684797267',
              '1.7452777E7',
              '41.0',
              '2.3491869263507552E-4',
              '29.0',
              '1.6616200210773635E-4',
              '8.369352925347222',
              0,
              '0.7777970000000001',
              0,
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
            [
              '2023-01-28T00:00Z',
              'CGDTDX5-79',
              'CG161',
              'DX5DT.CG',
              'CGDT',
              'Calgary',
              'CG',
              'AB',
              '3.02527716398778',
              '32.3',
              '1.066063440391396',
              '1.449114497498183',
              '2.5151779378895784',
              '0.25011471433300514',
              '0.32229288976948217',
              '0.5724076041024873',
              '1.578639853E9',
              '2.6381534E7',
              '1.6436274943320313',
              '58480.0',
              '0.0036434324049745247',
              '10.421527535204476',
              '13.619245736707567',
              '32.8064446',
              '29.461697398710868',
              '0.0',
              '0.0',
              '0.0',
              '0.0',
            ],
          ],
        },
        message: 'Success',
        reference_id: '1.1.210',
      },
    },
    showMask: true,
    shiftScreen: false,
    userDisplayName: 'Nikki',
    introMessage: undefined,
    enableAutocomplete: true,
    enableQueryInterpretation: true,
    enableFilterLocking: true,
    enableQueryValidation: true,
    enableQuerySuggestions: true,
    enableDrilldowns: true,
    enableExploreQueriesTab: true,
    enableDataExplorerTab: true,
    enableNotificationsTab: true,
    enableNotifications: true,
    enableColumnVisibilityManager: true,
    enableVoiceRecord: true,
    enableCSVDownload: true,
    dashboardTitleColor: 'rgb(72, 105, 142)',
    clearOnClose: false,
    height: 500,
    width: 550,
    title: 'Data Messenger',
    accentTextColor: '#ffffff',
    lightAccentColor: '#26a7df',
    darkAccentColor: '#26a7df',
    maxMessages: 20,
    isEditing: false,
    debug: true,
    test: !isProd(),
    demo: getStoredProp('demo') === 'true',
    apiKey: getStoredProp('api-key') || '',
    domain: getStoredProp('domain-url') || '',
    dprKey: getStoredProp('dpr-key') || '',
    dprDomain: getStoredProp('dpr-domain') || '',
    projectId: getStoredProp('customer-id') || '',
    themeCode: getStoredProp('theme-code') || '',
    displayName: getStoredProp('user-id') || '',
    currencyCode: 'USD',
    languageCode: 'en-US',
    currencyDecimals: undefined,
    quantityDecimals: undefined,
    fontFamily: 'sans-serif',
    runDashboardAutomatically: false,
    // comparisonDisplay: true, // hang onto for now: See QueryOutput line 1250-1255 for details
    chartColors: ['#26A7E9', '#A5CD39', '#DD6A6A', '#FFA700', '#00C1B2'],
    monthFormat: 'MMM YYYY',
    dayFormat: 'll',
    dashboardTiles: [],
    activeDashboardId: undefined,
    enableDynamicCharting: true,
    defaultTab: 'data-messenger',
    autoChartAggregations: true,
  }

  componentDidMount = () => {
    this.setTheme()
    this.testAuthentication()
      .then(() => {
        this.fetchDashboards()
      })
      .catch(() => {
        this.logoutUser()
      })
  }

  componentDidUpdate = (prevProps, prevState) => {
    if (
      !isEqual(this.state.chartColors !== prevState.chartColors) ||
      prevState.lightAccentColor !== this.state.lightAccentColor ||
      prevState.darkAccentColor !== this.state.darkAccentColor ||
      prevState.accentTextColor !== this.state.accentTextColor ||
      prevState.dashboardTitleColor !== this.state.dashboardTitleColor
    ) {
      this.setTheme()
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
      apiKey: this.state.apiKey,
      domain: this.state.domain,
      dprKey: this.state.dprKey,
      dprDomain: this.state.dprDomain,
    }
  }

  getAutoQLConfigProp = () => {
    return {
      enableQueryValidation: this.state.enableQueryValidation,
      enableAutocomplete: this.state.enableAutocomplete,
      enableQueryInterpretation: this.state.enableQueryInterpretation,
      enableFilterLocking: this.state.enableFilterLocking,
      enableDrilldowns: this.state.enableDrilldowns,
      enableColumnVisibilityManager: this.state.enableColumnVisibilityManager,
      enableQuerySuggestions: this.state.enableQuerySuggestions,
      enableNotifications: this.state.enableNotifications,
      debug: this.state.debug,
      test: this.state.test,
      enableCSVDownload: this.state.enableCSVDownload,
    }
  }

  getDataFormattingProp = () => {
    return {
      currencyCode: this.state.currencyCode,
      languageCode: this.state.languageCode,
      currencyDecimals: this.state.currencyDecimals,
      quantityDecimals: this.state.quantityDecimals,
      // hang onto for now. See QueryOutput line 1250-1255 for details
      // comparisonDisplay: this.state.comparisonDisplay ? 'PERCENT' : 'RATIO',
      monthYearFormat: this.state.monthFormat,
      dayMonthYearFormat: this.state.dayFormat,
    }
  }

  setTheme = () => {
    let lightAccentColor = this.state.lightAccentColor
    let darkAccentColor = this.state.darkAccentColor
    let accentTextColor = this.state.accentTextColor
    let chartColors = [...this.state.chartColors]
    let dashboardTitleColor = this.state.dashboardTitleColor

    const theme = {
      theme: this.state.theme,
      accentColor: this.state.theme === 'light' ? lightAccentColor : darkAccentColor,
      accentTextColor: accentTextColor,
      fontFamily: this.state.fontFamily,
      chartColors,
      dashboardTitleColor,
    }

    configureTheme(theme)
  }

  fetchNotificationData = (notificationId) => {
    const url = `${getBaseUrl()}/api/v1/rule-notifications/${notificationId}?key=${this.state.apiKey}`
    const token = getStoredProp('jwtToken')

    const config = {}
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
        'Integrator-Domain': this.state.domain,
      }
    }

    if (!this.state.apiKey || !this.state.domain) {
      return Promise.reject({ error: 'Unauthenticated' })
    }

    return axios
      .get(url, config)
      .then((response) => {
        if (response.data && typeof response.data === 'string') {
          return Promise.reject({ error: 'Parse error' })
        }
        if (
          !response ||
          !response.data ||
          !response.data.query_result ||
          !response.data.query_result.data ||
          response.data.query_result.data.display_type !== 'data'
        ) {
          return Promise.reject()
        }
        return Promise.resolve(response.data.query_result)
      })
      .catch((error) => {
        return Promise.reject(error)
      })
  }

  testAuthentication = () => {
    this.setState({
      isAuthenticated: true,
      activeIntegrator: this.getActiveIntegrator(),
      componentKey: uuid(),
    })
    return Promise.resolve()

    const url = `${this.state.domain}/autoql/api/v1/query/related-queries?key=${this.state.apiKey}&search=a&scope=narrow`
    const token = getStoredProp('jwtToken')

    const config = {}
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      }
    }

    if (!this.state.apiKey || !this.state.domain) {
      this.setState({
        isAuthenticated: false,
        activeIntegrator: undefined,
        componentKey: uuid(),
      })
      return Promise.reject()
    }

    return axios
      .get(url, config)
      .then(() => {
        this.setState({
          isAuthenticated: true,
          activeIntegrator: this.getActiveIntegrator(),
          componentKey: uuid(),
        })
        return Promise.resolve()
      })
      .catch((error) => {
        this.setState({
          isAuthenticated: false,
          activeIntegrator: undefined,
          componentKey: uuid(),
        })
        return Promise.reject(error)
      })
  }

  fetchDashboards = async () => {
    this.setState({
      isFetchingDashboard: true,
    })

    try {
      const jwtToken = getStoredProp('jwtToken')
      if (jwtToken) {
        const baseUrl = getBaseUrl()

        const url = `${baseUrl}/api/v1/dashboards?key=${this.state.apiKey}&project_id=${this.state.projectId}`
        const dashboardResponse = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Integrator-Domain': this.state.domain,
          },
        })

        let dashboardTiles
        let activeDashboardId
        let dashboardsList = []
        if (get(dashboardResponse, 'data.items.length')) {
          dashboardsList = sortBy(dashboardResponse.data.items, (dashboard) => {
            return new Date(dashboard.created_at)
          })
          dashboardTiles = get(dashboardsList, '[0].data')
          activeDashboardId = get(dashboardsList, '[0].id')
        }

        this.setState({
          dashboardsList,
          dashboardTiles,
          dashboardError: false,
          isFetchingDashboard: false,
          activeDashboardId,
        })
      }
    } catch (error) {
      console.error(error)
      this.setState({
        dashboardsList: undefined,
        dashboardTiles: [],
        dashboardError: true,
        isFetchingDashboard: false,
        activeDashboardId: null,
      })
    }
  }

  getJWT = async (loginToken) => {
    try {
      if (!loginToken) {
        throw new Error('Invalid Login Token')
      }

      const baseUrl = getBaseUrl()
      let url = `${baseUrl}/api/v1/jwt?display_name=${this.state.displayName}&project_id=${this.state.projectId}`

      // Use login token to get JWT token
      const jwtResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${loginToken}`,
        },
      })

      // Put jwt token into storage
      const jwtToken = jwtResponse.data
      setStoredProp('jwtToken', jwtToken)

      if (this.authTimer) {
        clearTimeout(this.authTimer)
      }
      this.authTimer = setTimeout(() => {
        this.setState({
          isAuthenticated: false,
        })
      }, 2.16e7)

      return this.testAuthentication()
        .then(() => {
          this.setState({
            isAuthenticated: true,
            isAuthenticating: false,
            componentKey: uuid(),
            activeIntegrator: this.getActiveIntegrator(),
          })

          return Promise.resolve()
        })
        .catch(() => {
          this.setState({
            isAuthenticated: false,
            isAuthenticating: false,
            activeIntegrator: undefined,
          })

          return Promise.reject()
        })
    } catch (error) {
      this.setState({ isAuthenticating: false })
    }
  }

  onLogin = async () => {
    try {
      this.setState({
        isAuthenticating: true,
      })
      const baseUrl = getBaseUrl()

      // Login to get login token
      const loginFormData = new FormData()
      loginFormData.append('username', this.state.email)
      loginFormData.append('password', this.state.password)
      const loginResponse = await axios.post(`${baseUrl}/api/v1/login`, loginFormData, {
        headers: {
          // 'Access-Control-Allow-Origin': '*'
        },
      })

      // Put login token in local storage
      const loginToken = loginResponse.data
      setStoredProp('loginToken', loginToken)

      await this.getJWT(loginToken)

      message.success('Login Sucessful!', 0.8)
      this.fetchDashboards()
    } catch (error) {
      console.error(error)
      // Clear tokens
      setStoredProp('loginToken', null)
      setStoredProp('jwtToken', null)
      this.setState({
        isAuthenticated: false,
        isAuthenticating: false,
        activeIntegrator: null,
        componentKey: uuid(),
      })

      // Dont fetch dashboard if authentication failed...
      message.error('Invalid Credentials')
    }
  }

  getActiveIntegrator = () => {
    const { domain } = this.state

    if (domain.includes('accounting-demo')) {
      return 'demo'
    }

    return undefined
  }

  createRadioInputGroup = (title, propName, propValues = [], reload) => {
    return (
      <div>
        <h4>{title}</h4>
        {reload && <h6>(Must click 'Reload Data Messenger' to apply this)</h6>}
        <Radio.Group
          defaultValue={this.state[propName]}
          onChange={(e) => this.setState({ [propName]: e.target.value })}
          buttonStyle='solid'
        >
          {propValues.map((propValue) => {
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
          onChange={(e) => {
            this.setState({ [propName]: e })
            setStoredProp(propName, e)
          }}
        />
      </div>
    )
  }

  onSortChartColors = (items) => {
    this.setState({
      items: items,
    })
  }

  onError = (error) => {
    // if (error && error.message && this.state.isAuthenticated) {
    //   message.error(`${error.message}`)
    // }
  }

  onSuccess = (alertText) => {
    if (alertText) {
      message.success(alertText)
    }
  }

  reloadDataMessenger = () => {
    this.setState({ componentKey: uuid() })
  }

  createDashboard = async () => {
    this.setState({
      isSavingDashboard: true,
    })

    try {
      const data = {
        username: this.state.username,
        project_id: this.state.projectId,
        name: this.state.dashboardNameInput,
      }

      const baseUrl = getBaseUrl()

      const url = `${baseUrl}/api/v1/dashboards?key=${this.state.apiKey}`

      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = [...this.state.dashboardsList, response.data]

      this.setState({
        dashboardsList: newDashboardsList,
        dashboardTiles: response.data.data,
        activeDashboardId: response.data.id,
        isSavingDashboard: false,
        isEditing: true,
        isNewDashboardModalOpen: false,
        dashboardNameInput: undefined,
      })
    } catch (error) {
      message.error(error.message)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  deleteDashboard = async () => {
    this.setState({
      isDeletingDashboard: true,
    })

    try {
      const baseUrl = getBaseUrl()
      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}&project_id=${this.state.projectId}`

      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = this.state.dashboardsList.filter(
        (dashboard) => dashboard.id !== this.state.activeDashboardId,
      )
      const newActiveDashboardId = newDashboardsList[0] ? newDashboardsList[0].id : undefined
      const newDashboardTiles = newDashboardsList[0] ? newDashboardsList[0].data : undefined

      this.setState({
        dashboardsList: newDashboardsList,
        activeDashboardId: newActiveDashboardId,
        dashboardTiles: newDashboardTiles,
        isDeletingDashboard: false,
        isEditing: false,
      })
    } catch (error) {
      console.error(error)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  saveDashboard = async () => {
    this.setState({
      isSavingDashboard: true,
    })

    try {
      const index = this.state.dashboardsList.findIndex((dashboard) => dashboard.id === this.state.activeDashboardId)
      const activeDashboard = this.state.dashboardsList[index]

      const data = {
        username: this.state.username,
        name: activeDashboard.name,
        data: this.state.dashboardTiles.map((tile) => {
          return {
            ...tile,
            queryResponse: undefined,
            secondQueryResponse: undefined,
          }
        }),
      }

      const baseUrl = getBaseUrl()

      const url = `${baseUrl}/api/v1/dashboards/${this.state.activeDashboardId}?key=${this.state.apiKey}`

      await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${getStoredProp('jwtToken')}`,
          'Integrator-Domain': this.state.domain,
        },
      })

      const newDashboardsList = cloneDeep(this.state.dashboardsList)
      newDashboardsList[index].data = this.state.dashboardTiles.map((tile) => {
        return {
          ...tile,
          queryResponse: undefined,
          secondQueryResponse: undefined,
        }
      })

      this.setState({
        isSavingDashboard: false,
        dashboardsList: newDashboardsList,
        isEditing: false,
      })
    } catch (error) {
      console.error(error)
      this.setState({
        isSavingDashboard: false,
        dashboardError: true,
      })
    }
  }

  resetDashboard = () => {
    try {
      if (this.state.dashboardTiles) {
        const newDashboardTiles = this.state.dashboardTiles.map((tile) => {
          return {
            ...tile,
            queryResponse: undefined,
            secondQueryResponse: undefined,
          }
        })

        this.setState({ dashboardTiles: newDashboardTiles })
      }
    } catch (error) {
      console.error(error)
    }
  }

  renderChartColorsList = () => {
    const { chartColors } = this.state
    var listItems = chartColors.map((item, i) => {
      return (
        <SortableItem key={i} onSortItems={this.onSortChartColors} items={chartColors} item={item} sortId={i}>
          {item}
          <CloseOutlined
            style={{ float: 'right', cursor: 'pointer', marginTop: '3px' }}
            onClick={() => {
              const newChartColors = this.state.chartColors.filter((color) => color !== item)
              this.setState({ chartColors: newChartColors })
            }}
          />
        </SortableItem>
      )
    })

    return (
      <div>
        <ul style={{ padding: 0, marginBottom: '3px' }} className='sortable-list'>
          {listItems}
        </ul>
        <Input
          placeholder='New Color'
          value={this.state.newColorInput}
          onChange={(e) => this.setState({ newColorInput: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const newChartColors = [...this.state.chartColors, e.target.value]
              this.setState({ chartColors: newChartColors, newColorInput: '' })
            }
          }}
        />
      </div>
    )
  }

  logoutUser = () => {
    this.setState({
      isAuthenticated: false,
      dashboardTiles: undefined,
    })
    setStoredProp('loginToken', undefined)
    setStoredProp('jwtToken', undefined)
    message.success('Successfully logged out')
  }

  renderAuthenticationForm = () => {
    const layout = {
      labelCol: { span: 8 },
      wrapperCol: { span: 16 },
    }
    const tailLayout = {
      wrapperCol: { offset: 8, span: 16 },
    }

    return (
      <Fragment>
        <Form
          {...layout}
          initialValues={{
            projectId: this.state.projectId,
            displayName: this.state.displayName,
            apiKey: this.state.apiKey,
            domain: this.state.domain,
          }}
          style={{ marginTop: '20px' }}
          onFinish={this.onLogin}
          onFinishFailed={(errorInfo) => console.error('Failed:', errorInfo)}
        >
          <Form.Item
            label='Project ID'
            name='projectId'
            rules={[{ required: true, message: 'Please enter your project ID' }]}
          >
            <Input
              name='customer-id'
              onChange={(e) => {
                this.setState({ projectId: e.target.value })
              }}
              onBlur={(e) => setStoredProp('customer-id', e.target.value)}
              value={this.state.projectId}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='User Email'
            name='displayName'
            rules={[{ required: true, message: 'Please enter your email' }]}
          >
            <Input
              name='user-id'
              onChange={(e) => {
                this.setState({ displayName: e.target.value })
              }}
              onBlur={(e) => setStoredProp('user-id', e.target.value)}
              value={this.state.displayName}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item label='API key' name='apiKey' rules={[{ required: true, message: 'Please enter your API key' }]}>
            <Input
              name='api-key'
              onChange={(e) => {
                this.setState({ apiKey: e.target.value })
              }}
              onBlur={(e) => setStoredProp('api-key', e.target.value)}
              value={this.state.apiKey}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='Domain URL'
            name='domain'
            rules={[{ required: true, message: 'Please enter your domain URL' }]}
          >
            <Input
              name='domain-url'
              onChange={(e) => {
                this.setState({ domain: e.target.value })
              }}
              onBlur={(e) => setStoredProp('domain-url', e.target.value)}
              value={this.state.domain}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='Username'
            name='username'
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input
              onChange={(e) => {
                this.setState({ email: e.target.value })
              }}
              value={this.state.email}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item
            label='Password'
            name='password'
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input
              type='password'
              onChange={(e) => {
                this.setState({ password: e.target.value })
              }}
              value={this.state.password}
              // autoComplete="on"
            />
          </Form.Item>
          <Form.Item label='DPR API key' name='dprKey'>
            <Input
              name='dpr-key'
              onChange={(e) => {
                this.setState({ dprKey: e.target.value })
              }}
              onBlur={(e) => setStoredProp('dpr-key', e.target.value)}
              value={this.state.dprKey}
            />
          </Form.Item>
          <Form.Item label='DPR Domain' name='dprDomain'>
            <Input
              name='dpr-domain'
              onChange={(e) => {
                this.setState({ dprDomain: e.target.value })
              }}
              onBlur={(e) => setStoredProp('dpr-domain', e.target.value)}
              value={this.state.dprDomain}
            />
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type='primary' htmlType='submit' loading={this.state.isAuthenticating}>
              Authenticate
            </Button>
          </Form.Item>
          <Form.Item {...tailLayout}>
            <Button type='default' onClick={this.logoutUser}>
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
        {!this.state.isAuthenticated ? <div style={{ color: 'red', fontSize: '16px' }}>Please authenticate</div> : null}
        <h1>Authentication</h1>
        {this.renderAuthenticationForm()}
        {this.createBooleanRadioGroup('Enable Infinite Scroll and API Filtering/Sorting', 'pagination', [true, false])}
        <h1>Customize Widgets</h1>
        <Button onClick={this.reloadDataMessenger} style={{ marginRight: '10px' }} icon={<ReloadOutlined />}>
          Reload Data Messenger
        </Button>
        <Button onClick={this.dmRef?.open} type='primary' icon={<MenuFoldOutlined />}>
          Open Data Messenger
        </Button>
        <h2>AutoQL API Configuration Options</h2>
        {this.createBooleanRadioGroup('Enable Autocomplete', 'enableAutocomplete', [true, false])}
        {this.createBooleanRadioGroup('Enable Filter Locking', 'enableFilterLocking', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Interpretation', 'enableQueryInterpretation', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Validation', 'enableQueryValidation', [true, false])}
        {this.createBooleanRadioGroup('Enable Query Suggestions', 'enableQuerySuggestions', [true, false])}
        {this.createBooleanRadioGroup('Enable Drilldowns', 'enableDrilldowns', [true, false])}
        {this.createBooleanRadioGroup('Enable Column Visibility Editor', 'enableColumnVisibilityManager', [
          true,
          false,
        ])}
        {this.createBooleanRadioGroup('Enable Notifications', 'enableNotifications', [true, false])}
        {this.createBooleanRadioGroup('Enable CSV Download', 'enableCSVDownload', [true, false])}
        {this.createBooleanRadioGroup('Debug Mode - Show copy to SQL button in message toolbar', 'debug', [
          true,
          false,
        ])}
        {!isProd() &&
          this.createBooleanRadioGroup('Test Mode (Provides extra logging on the server side)', 'test', [true, false])}
        <h2>UI Configuration Options</h2>
        {this.createBooleanRadioGroup('Show Data Messenger Button', 'showHandle', [true, false])}
        {this.createBooleanRadioGroup('Shift Screen on Open/Close', 'shiftScreen', [true, false])}
        {this.createBooleanRadioGroup('Darken Background Behind Data Messenger', 'showMask', [true, false])}
        {this.createRadioInputGroup('Theme', 'theme', ['light', 'dark'])}
        {this.createRadioInputGroup('Data Messenger Placement', 'placement', ['top', 'bottom', 'left', 'right'])}
        {this.createRadioInputGroup('Default Tab', 'defaultTab', ['data-messenger', 'explore-queries'], true)}
        {this.createBooleanRadioGroup('Auto-Chart Aggregation queries', 'autoChartAggregations', [true, false])}
        <h4>Currency Code</h4>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ currencyCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.currencyCode}
        />
        <h4>Language Code</h4>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ languageCode: e.target.value })
          }}
          style={{ width: '55px' }}
          defaultValue={this.state.languageCode}
        />
        <h4>Format for Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href='https://devhints.io/moment' target='_blank' rel='noopener noreferrer'>
            View the cheat sheet
          </a>
        </h6>
        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ monthFormat: e.target.value })
          }}
          defaultValue={this.state.monthFormat}
        />
        <h4>Format for Day, Month, Year</h4>
        <h6>
          Don't know the syntax for formats?{' '}
          <a href='https://devhints.io/moment' target='_blank' rel='noopener noreferrer'>
            View the cheat sheet
          </a>
        </h6>

        <Input
          type='text'
          onBlur={(e) => {
            this.setState({ dayFormat: e.target.value })
          }}
          defaultValue={this.state.dayFormat}
        />
        <h4>Number of Decimals for Currency Values</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ currencyDecimals: e })
          }}
          value={this.state.currencyDecimals}
        />
        <h4>Number of Decimals for Quantity Values</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ quantityDecimals: e })
          }}
          value={this.state.quantityDecimals}
        />
        <h4>User Display Name</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ userDisplayName: e.target.value })
          }}
          value={this.state.userDisplayName}
        />
        <h4>Intro Message</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ introMessage: e.target.value })
          }}
          value={this.state.introMessage}
        />
        <h4>Query Input Placeholder</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ inputPlaceholder: e.target.value })
          }}
          value={this.state.inputPlaceholder}
        />
        <h4>Query Input Value</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ inputValue: e.target.value })
          }}
          value={this.state.inputValue}
        />
        {this.createBooleanRadioGroup('Clear All Messages on Close', 'clearOnClose', [true, false])}
        <h4>Height</h4>
        <h5>Only for top/bottom placement</h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <InputNumber
          // type="number"
          onChange={(e) => {
            this.setState({ height: e })
          }}
          value={this.state.height}
        />
        <h4>Width</h4>
        <h5>Only for left/right placement</h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ width: e })
          }}
          value={this.state.width}
        />
        <h4>Title</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ title: e.target.value })
          }}
          value={this.state.title}
        />
        <h4>Font Family</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ fontFamily: e.target.value })
          }}
          value={this.state.fontFamily}
        />
        <h4>Chart Colors</h4>
        <h5>
          This is an array of colors used for the charts. If the data scale is larger than the color array, it will
          repeat the colors. Any solid color formats are accepted. Hit "enter" to add a color.
        </h5>
        {this.renderChartColorsList()}
        {this.createBooleanRadioGroup('Enable Dynamic Charting', 'enableDynamicCharting', [true, false])}
        <h4>Dashboard Title Color</h4>
        <Input
          type='text'
          onChange={(e) => {
            this.setState({ dashboardTitleColor: e.target.value })
          }}
          value={this.state.dashboardTitleColor}
        />
        <h4>Text/Icon Color</h4>
        <Input
          type='color'
          onChange={(e) => {
            this.setState({ accentTextColor: e.target.value })
          }}
          value={this.state.accentTextColor}
        />

        <h4>Light Theme Accent Color</h4>
        <h5>
          For production version, the user will just choose "accentColor" and it
          <br />
          will be applied to whatever theme. If not provided, the default color
          <br />
          will be used
        </h5>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='color'
          onChange={(e) => {
            this.setState({ lightAccentColor: e.target.value })
          }}
          value={this.state.lightAccentColor}
        />
        <h4>Dark Theme Accent Color</h4>
        <h6>(Must click 'Reload Data Messenger' to apply this)</h6>
        <Input
          type='color'
          onChange={(e) => {
            this.setState({ darkAccentColor: e.target.value })
          }}
          value={this.state.darkAccentColor}
        />
        <h4>Maximum Number of Messages</h4>
        <InputNumber
          type='number'
          onChange={(e) => {
            this.setState({ maxMessages: e })
          }}
          value={this.state.maxMessages}
        />
        {this.createBooleanRadioGroup('Enable Explore Queries Tab', 'enableExploreQueriesTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Data Explorer Tab', 'enableDataExplorerTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Notifications Tab', 'enableNotificationsTab', [true, false])}
        {this.createBooleanRadioGroup('Enable Speech to Text', 'enableVoiceRecord', [true, false])}
      </div>
    )
  }

  renderDataMessenger = () => {
    return (
      <DataMessenger
        ref={(r) => (this.dmRef = r)}
        inputValue={this.state.inputValue}
        className={`${this.state.activeIntegrator}`}
        enableDPRTab={!!this.state.dprKey}
        authentication={this.getAuthProp()}
        autoQLConfig={this.getAutoQLConfigProp()}
        dataFormatting={this.getDataFormattingProp()}
        key={this.state.componentKey}
        AutoAEId={this.state.componentKey}
        maskClosable
        showHandle={this.state.showHandle}
        enableAjaxTableData={this.state.pagination}
        placement={
          this.state.currentPage === 'drawer' ||
          this.state.currentPage === 'dashboard' ||
          this.state.currentPage === 'speech'
            ? this.state.placement
            : 'bottom'
        }
        userDisplayName={this.state.userDisplayName}
        introMessage={this.state.introMessage}
        showMask={this.state.showMask}
        shiftScreen={this.state.shiftScreen}
        enableVoiceRecord={this.state.enableVoiceRecord}
        clearOnClose={this.state.clearOnClose}
        width={this.state.width}
        height={this.state.height}
        title={this.state.title}
        maxMessages={this.state.maxMessages}
        enableExploreQueriesTab={this.state.enableExploreQueriesTab}
        enableDataExplorerTab={this.state.enableDataExplorerTab}
        enableNotificationsTab={this.state.enableNotificationsTab}
        onErrorCallback={this.onError}
        onSuccessAlert={this.onSuccess}
        inputPlaceholder={this.state.inputPlaceholder}
        inputStyles
        handleStyles={{ right: '25px' }}
        enableDynamicCharting={this.state.enableDynamicCharting}
        onNotificationExpandCallback={this.fetchNotificationContent}
        onNotificationCollapseCallback={() => {
          this.setState({ currentNotificationContent: null })
        }}
        activeNotificationData={this.state.activeNotificationContent}
        defaultTab={this.state.defaultTab}
        autoChartAggregations={this.state.autoChartAggregations}
        enableQueryQuickStartTopics={true}
      />
    )
  }

  renderDataMessengerPage = () => {
    return <div className='test-page-container'>{this.renderPropOptions()}</div>
  }

  renderQueryInputPage = () => {
    return (
      <div>
        <QueryInput
          authentication={this.getAuthProp()}
          autoQLConfig={this.getAutoQLConfigProp()}
          dataFormatting={this.getDataFormattingProp()}
          ref={(r) => (this.queryInputRef = r)}
          autoCompletePlacement='below'
          clearQueryOnSubmit={false}
          onSubmit={() => this.setState({ response: null })}
          onResponseCallback={(response) => {
            this.setState({ response })
          }}
          showChataIcon
          showLoadingDots
        />
        <Button
          onClick={() => {
            if (this.queryOutputRef?.refreshLayout) {
              this.queryOutputRef.refreshLayout()
            }
          }}
        >
          Resize Chart
        </Button>
        {this.state.response && (
          <div
            style={{
              // height: 'auto',
              // minHeight: '100px',
              height: 'calc(100vh - 140px)',
              overflow: 'hidden',
              // padding: '20px',
              // paddingTop: '0',
              // paddingBottom: '0',
              fontFamily: 'Helvetica, Arial, Sans-Serif', // Text, tables, and charts will inherit font
              color: '#565656', // Text, tables, and charts will inherit text color
            }}
          >
            <QueryOutput
              ref={(r) => (this.queryOutputRef = r)}
              authentication={this.getAuthProp()}
              autoQLConfig={this.getAutoQLConfigProp()}
              dataFormatting={this.getDataFormattingProp()}
              queryInputRef={this.queryInputRef}
              queryResponse={this.state.response}
              initialDisplayType='column'
              enableAjaxTableData={true}
              autoChartAggregations={true}
              enableDynamicCharting={true}
            />
          </div>
        )}
      </div>
    )
  }

  handleDashboardSelect = (value) => {
    if (value === 'new-dashboard') {
      this.setState({ isNewDashboardModalOpen: true })
    } else {
      const newDashboard = this.state.dashboardsList.find((dashboard) => dashboard.id === value)

      this.setState({
        activeDashboardId: value,
        dashboardTiles: newDashboard.data,
      })
    }
  }

  handleTileChange = (newTiles) => {
    this.setState({ dashboardTiles: newTiles })
  }

  renderConfirmDeleteDashboardModal = () => {
    return Modal.confirm({
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete Dashboard',
      okType: 'danger',
      onOk: this.deleteDashboard,
      okButtonProps: { ghost: true },
      onCancel: () => this.setState({ isDeleteDashboardModalVisible: false }),
      title: 'Are you sure you want to delete this Dashboard?',
    })
  }

  setIsEditing = () => {
    this.setState({ isEditing: true })
  }

  openNewDashboardModal = () => this.setState({ isNewDashboardModalOpen: true })

  renderDashboardPage = () => {
    if (this.state.isFetchingDashboard) {
      return <Spin />
    }

    return (
      <div
        className='dashboard-container'
        style={{
          width: '100%',
          height: 'auto',
          minHeight: 'calc(100vh - 185px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {this.renderNewDashboardModal()}
        {this.state.activeDashboardId ? (
          <Fragment>
            <div
              className='dashboard-toolbar-container'
              style={{
                textAlign: 'center',
                padding: '10px',
              }}
            >
              <div>
                <Select
                  style={{ minWidth: '200px' }}
                  onChange={this.handleDashboardSelect}
                  value={this.state.activeDashboardId}
                >
                  {this.state.dashboardsList &&
                    this.state.dashboardsList.map((dashboard) => {
                      return (
                        <Select.Option value={dashboard.id} key={`dashboard-option-${dashboard.id}`}>
                          {dashboard.name}
                        </Select.Option>
                      )
                    })}
                  <Select.Option value='new-dashboard'>
                    <PlusOutlined /> New Dashboard
                  </Select.Option>
                </Select>
              </div>
              <Button
                onClick={() => this.setState({ isEditing: !this.state.isEditing })}
                icon={this.state.isEditing ? <StopOutlined /> : <EditOutlined />}
              >
                {this.state.isEditing ? 'Cancel' : 'Edit'}
              </Button>
              <Button
                onClick={() => executeDashboard(this.dashboardRef)}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Execute
              </Button>
              <Button
                onClick={() => unExecuteDashboard(this.dashboardRef)}
                icon={<PlayCircleOutlined />}
                style={{ marginLeft: '10px' }}
              >
                Un-Execute
              </Button>
              <Button onClick={() => console.log(this.state.dashboardTiles)} style={{ marginLeft: '10px' }}>
                Log Current Tile State
              </Button>

              <br />
              {this.state.isEditing && (
                <Button
                  onClick={() => this.dashboardRef && this.dashboardRef.addTile()}
                  type='primary'
                  icon={<PlusOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Add Tile
                </Button>
              )}
              {this.state.isEditing && (
                <Button
                  onClick={() => this.dashboardRef && this.dashboardRef.undo()}
                  type='primary'
                  icon={<RollbackOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Undo
                </Button>
              )}
              {this.state.isEditing && (
                <Button
                  onClick={this.saveDashboard}
                  loading={this.state.isSavingDashboard}
                  type='primary'
                  icon={<SaveOutlined />}
                  style={{ marginLeft: '10px' }}
                >
                  Save Dashboard
                </Button>
              )}
              {
                // Keep this out for now, we risk people deleting important test dashboards
                //   this.state.isEditing && (
                //   <Button
                //     onClick={this.renderConfirmDeleteDashboardModal}
                //     loading={this.state.isDeletingDashboard}
                //     type="danger"
                //     ghost
                //     icon={<DeleteOutlined />}
                //     style={{ marginLeft: '10px' }}
                //   >
                //     Delete Dashboard
                //   </Button>
                // )
              }
            </div>

            <Dashboard
              ref={(ref) => (this.dashboardRef = ref)}
              key={this.state.activeDashboardId}
              authentication={this.getAuthProp()}
              autoQLConfig={this.getAutoQLConfigProp()}
              dataFormatting={this.getDataFormattingProp()}
              isEditing={this.state.isEditing}
              startEditingCallback={this.setIsEditing}
              executeOnMount={this.state.runDashboardAutomatically}
              executeOnStopEditing={this.state.runDashboardAutomatically}
              enableDynamicCharting={this.state.enableDynamicCharting}
              tiles={this.state.dashboardTiles}
              notExecutedText='Hit "Execute" to run this dashboard'
              onErrorCallback={this.onError}
              onSuccessCallback={this.onSuccess}
              autoChartAggregations={this.state.autoChartAggregations}
              enableAjaxTableData={this.state.pagination}
              onChange={this.handleTileChange}
            />
          </Fragment>
        ) : (
          <div style={{ marginTop: '100px', textAlign: 'center' }}>
            <Button type='primary' onClick={this.openNewDashboardModal}>
              Create a new Dashboard
            </Button>
          </div>
        )}
      </div>
    )
  }

  renderNavMenu = () => {
    const items = [
      {
        label: (
          <span>
            <ChataIcon type='react-autoql-bubbles-outlined' /> Data Messenger
          </span>
        ),
        key: 'drawer',
      },
    ]

    if (this.state.isAuthenticated) {
      items.push({
        label: (
          <span>
            <ChataIcon type='dashboard' /> Dashboard
          </span>
        ),
        key: 'dashboard',
      })
      items.push({ label: 'QueryInput / QueryOutput', key: 'chatbar' })

      if (this.state.enableNotifications) {
        items.push({ label: 'Data Alerts Manager', key: 'settings' })
        items.push({
          label: (
            <NotificationIcon
              ref={(r) => (this.notificationBadgeRef = r)}
              authentication={this.getAuthProp()}
              clearCountOnClick={false}
              style={{ fontSize: '18px' }}
              onNewNotification={() => {
                // If a new notification is detected, refresh the list
                if (this.notificationListRef && this.state.currentPage === 'notifications') {
                  this.notificationListRef.refreshNotifications()
                }
              }}
              onErrorCallback={this.onError}
            />
          ),
          key: 'notifications',
        })
      }
    }

    items.push({ label: 'Reviews', key: 'reviews' })
    items.push({ label: 'Speech Training', key: 'speech' })

    return (
      <Menu
        onClick={({ key }) => {
          this.setState({ currentPage: key })
          this.resetDashboard()
          if (key === 'notifications' && this.notificationBadgeRef) {
            this.notificationBadgeRef.resetCount()
          }
        }}
        selectedKeys={[this.state.currentPage]}
        mode='horizontal'
        items={items}
      />
    )
  }

  renderNewDashboardModal = () => {
    return (
      <Modal
        visible={this.state.isNewDashboardModalOpen}
        confirmLoading={this.state.isSavingDashboard}
        onOk={this.createDashboard}
        okText='Create Dashboard'
        okButtonProps={{ disabled: !this.state.dashboardNameInput }}
        onCancel={() => this.setState({ isNewDashboardModalOpen: false })}
        title='New Dashboard'
      >
        <Input
          placeholder='Dashboard Name'
          value={this.state.dashboardNameInput}
          onChange={(e) => this.setState({ dashboardNameInput: e.target.value })}
          onPressEnter={this.createDashboard}
        />
      </Modal>
    )
  }

  fetchNotificationContent = (notification) => {
    this.setState({
      activeNotificationContent: null,
      isFetchingNotificationContent: true,
    })

    // this.executeQuery(notification.query)
    this.fetchNotificationData(notification.id)
      .then((response) => {
        this.setState({
          activeNotificationContent: response,
          isFetchingNotificationContent: false,
        })
      })
      .catch((error) => {
        this.setState({
          activeNotificationContent: {
            error: 'Unable to find data.',
          },
          isFetchingNotificationContent: false,
        })
      })
    // .finally(response => {
    //   this.setState({
    //     activeNotificationContent: response,
    //     isFetchingNotificationContent: false
    //   })
    // })
  }

  renderNotificationContent = (notification) => {
    if (this.state.isFetchingNotificationContent) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
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
      <QueryOutput
        authentication={this.getAuthProp()}
        queryResponse={this.state.activeNotificationContent}
        initialDisplayType='table'
      />
    )
  }

  renderNotificationsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 48px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto',
        }}
      >
        <NotificationFeed
          ref={(ref) => (this.notificationListRef = ref)}
          authentication={this.getAuthProp()}
          onExpandCallback={this.fetchNotificationContent}
          autoChartAggregations={this.state.autoChartAggregations}
          showCreateAlertBtn={true}
          onCollapseCallback={() => {
            this.setState({ currentNotificationContent: null })
          }}
          activeNotificationData={this.state.activeNotificationContent}
          onErrorCallback={this.onError}
          onSuccessCallback={this.onSuccess}
        />
      </div>
    )
  }

  renderSettingsPage = () => {
    return (
      <div
        style={{
          height: 'calc(100vh - 48px)',
          background: 'rgb(250,250,250)',
          overflow: 'auto',
        }}
      >
        <DataAlerts
          authentication={this.getAuthProp()}
          onErrorCallback={this.onError}
          showCreateAlertBtn
          onSuccessAlert={this.onSuccess}
        />
      </div>
    )
  }

  renderUIOverlay = () => {
    if (!this.state.isAuthenticated) {
      return null
    }

    // Only render overlay if drawer is active and prop is enabled
    if (!this.state.uiOverlay || this.state.currentPage !== 'drawer') {
      return null
    }

    // Accounting demo
    if (this.state.activeIntegrator === 'demo') {
      return <div className='ui-overlay demo' />
    }
  }

  renderMaintenancePage = () => (
    <div
      style={{
        margin: '0 auto',
        width: '300px',
        textAlign: 'center',
        paddingTop: '111px',
      }}
    >
      <ToolOutlined style={{ fontSize: '75px', marginBottom: '20px' }} />
      <br />
      <div style={{ fontSize: '25px' }}>We're undergoing a bit of scheduled maintenance.</div>
      <hr style={{ margin: '25px 0px' }} />
      <div>Sorry for the inconvenience. We will be back up and running as soon as possible.</div>
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
        pageToRender = this.renderQueryInputPage()
        break
      }
      case 'reviews': {
        pageToRender = <SentimentAnalysisPage />
        break
      }
      case 'speech': {
        pageToRender = (
          <SpeechToTextPage
            authentication={this.getAuthProp()}
            userEmail={this.state.displayName}
            projectID={this.state.projectId}
          />
        )
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
        {this.state.isAuthenticated && this.state.currentPage !== 'chatbar' && this.renderDataMessenger()}
        {pageToRender}
      </div>
    )
  }
}
