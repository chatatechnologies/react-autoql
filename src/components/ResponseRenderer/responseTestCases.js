export default [
  {},
  { data: { displayType: 'table' } },
  {
    data: {
      columns: [],
      displayType: null,
      interpretation: 'all invoices for invoice of this month ',
      queryId: 'q_VzB9irC-RpKY-13XwgHrrw',
      rows: null
    },
    message: '',
    referenceId: '1.1.0'
  },
  {
    data: {
      columns: [
        {
          type: 'DATE',
          groupable: true,
          active: false,
          name: 'sale__transaction_date__month'
        },
        {
          active: false,
          groupable: false,
          name: 'sale__line_item___sum',
          type: 'DOLLAR_AMT'
        }
      ],
      displayType: 'date_pivot',
      interpretation: 'total sales by line item by transaction month',
      queryId: 'q_y4sWT0IAStWnLeM7COEsSQ',
      rows: [
        [1483142400, 12500],
        [1488240000, 8742.68],
        [1490918400, 11723.36],
        [1493510400, 3243.12],
        [1496188800, 14642.19]
      ]
    },
    message: '',
    referenceId: '1.1.0'
  },
  {
    data: {
      columns: [
        { type: 'STRING', groupable: false, active: false, name: 'Help Link' }
      ],

      active: false,
      groupable: false,
      name: 'Help Link',
      type: 'STRING',
      displayType: 'help',
      interpretation: 'help on bar-chart',
      queryId: 'q_t_LufuRpQsGh71LE51qYnA',
      rows: [['http://chata.ai/userguide/#bar-chart-2']]
    },
    message: '',
    referenceId: '1.1.0'
  }
]
