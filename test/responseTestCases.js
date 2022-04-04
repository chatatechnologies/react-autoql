export default [
  // 0. empty response
  { data: {} },
  // 1. only display type returned, nothing else
  {
    data: {
      data: { display_type: 'table' },
    },
  },
  {
    // 2. no data and no display type
    data: {
      data: {
        columns: [],
        display_type: null,
        interpretation: 'all invoices for invoice of this month ',
        query_id: 'q_VzB9irC-RpKY-13XwgHrrw',
        rows: null,
      },
      message: '',
      referenceId: '1.1.0',
    },
  },
  {
    // 3. valid pivot data response
    data: {
      data: {
        columns: [
          {
            type: 'DATE',
            groupable: true,
            active: false,
            name: 'sale__transaction_date__month',
          },
          {
            active: false,
            groupable: false,
            name: 'sale__line_item___sum',
            type: 'DOLLAR_AMT',
          },
        ],
        display_type: 'date_pivot',
        interpretation: 'total sales by line item by transaction month',
        query_id: 'q_y4sWT0IAStWnLeM7COEsSQ',
        rows: [
          [1483142400, 12500],
          [1488240000, 8742.68],
          [1490918400, 11723.36],
          [1493510400, 3243.12],
          [1496188800, 14642.19],
        ],
      },
      message: '',
      referenceId: '1.1.0',
    },
  },
  {
    // 4. valid help response
    data: {
      data: {
        columns: [
          {
            type: 'STRING',
            groupable: false,
            active: false,
            name: 'Help Link',
          },
        ],

        active: false,
        groupable: false,
        name: 'Help Link',
        type: 'STRING',
        display_type: 'help',
        interpretation: 'help on bar-chart',
        query_id: 'q_t_LufuRpQsGh71LE51qYnA',
        rows: [['http://chata.ai/userguide/#bar-chart-2']],
      },
      message: '',
      referenceId: '1.1.0',
    },
  },
  {
    // 5. valid suggestion response
    data: {
      data: {
        columns: [
          {
            type: 'STRING',
            groupable: false,
            active: false,
            name: 'query_suggestion',
          },
        ],
        display_type: 'suggestion',
        interpretation: '',
        query_id: 'q_3Kh8CIxGS5SYwmIt4aqeuQ',
        rows: [
          ['All invoices in this year'],
          ['All expenses in this year'],
          ['Show me all invoices in this month'],
          ['List all customers'],
          ['None of these'],
        ],
      },
      message: '',
      referenceId: '1.1.0',
    },
  },
  {
    // 6. valid validation response single suggestion
    data: {
      full_suggestion: [
        {
          start: 10,
          suggestion_list: [
            { text: 'Jane Johnson', value_label: 'customer name' },
          ],
          end: 14,
        },
      ],
      query: 'sales for john',
    },
  },
  {
    // 7. display type that we dont understand
    data: {
      data: {
        columns: [
          {
            type: 'DATE',
            groupable: true,
            active: false,
            name: 'sale__transaction_date__month',
          },
          {
            active: false,
            groupable: false,
            name: 'sale__line_item___sum',
            type: 'DOLLAR_AMT',
          },
        ],
        display_type: 'unknown_type',
        interpretation: 'total sales by line item by transaction month',
        query_id: 'q_y4sWT0IAStWnLeM7COEsSQ',
        rows: [
          [1483142400, 12500],
          [1488240000, 8742.68],
          [1490918400, 11723.36],
          [1493510400, 3243.12],
          [1496188800, 14642.19],
        ],
      },
      message: '',
      referenceId: '1.1.0',
    },
  },
]
