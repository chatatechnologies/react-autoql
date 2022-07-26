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
      reference_id: '1.1.210',
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
        display_type: 'data',
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
      message: 'Success',
      reference_id: '1.1.210',
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
      message: 'Success',
      reference_id: '1.1.210',
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
      message: 'Success',
      reference_id: '1.1.210',
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
    message: 'Success',
    reference_id: '1.1.210',
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
      message: 'Success',
      reference_id: '1.1.210',
    },
  },
  {
    // 8. valid regular table data response
    data: {
      data: {
        columns: [
          {
            display_name: 'Quantity',
            type: 'QUANTITY',
            groupable: true,
            active: false,
            is_visible: true,
            name: 'sale__transaction_date__month',
          },
          {
            display_name: 'Amount',
            active: false,
            groupable: false,
            is_visible: true,
            name: 'sale__line_item___sum',
            type: 'DOLLAR_AMT',
          },
        ],
        display_type: 'data',
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
      message: 'Success',
      reference_id: '1.1.210',
    },
  },
  {
    // 9. valid list data
    data: {
      message: 'Success',
      data: {
        sql: [''],
        chart_images: null,
        fe_req: {
          test: false,
          debug: false,
          chart_images: 'exclude',
          text: 'all online sales',
          disambiguation: [],
          filters: [],
          orders: [],
          source: 'data_messenger',
          session_locked_conditions: {},
          session_filter_conditions: [],
          translation: 'exclude',
          page_size: 50,
        },
        display_type: 'data',
        persistent_locked_conditions: ['East'],
        interpretation: "all online sales 'East' (Customer Region)",
        text: 'all online sales',
        columns: [
          {
            display_name: 'Sales Date',
            type: 'DATE',
            multi_series: false,
            is_visible: true,
            name: 'dd_sale.date',
            groupable: false,
          },
          {
            display_name: 'Transaction Number',
            type: 'QUANTITY',
            multi_series: false,
            is_visible: true,
            name: 'online_sales.online_sales_fact.pos_transaction_number',
            groupable: false,
          },
          {
            display_name: 'Customer',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.customer_dimension.customer_name',
            groupable: false,
          },
          {
            display_name: 'Customer Type',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.customer_dimension.customer_type',
            groupable: false,
          },
          {
            display_name: 'Customer Region',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.customer_dimension.customer_region',
            groupable: false,
          },
          {
            display_name: 'Customer State',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.customer_dimension.customer_state',
            groupable: false,
          },
          {
            display_name: 'Category',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.product_dimension.category_description',
            groupable: false,
          },
          {
            display_name: 'Department',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.product_dimension.department_description',
            groupable: false,
          },
          {
            display_name: 'Product Description',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.product_dimension.product_description',
            groupable: false,
          },
          {
            display_name: 'Quantity',
            type: 'QUANTITY',
            multi_series: false,
            is_visible: true,
            name: 'online_sales.online_sales_fact.sales_quantity',
            groupable: false,
          },
          {
            display_name: 'Online Sales Amount',
            type: 'DOLLAR_AMT',
            multi_series: false,
            is_visible: true,
            name: 'online_sales.online_sales_fact.sales_dollar_amount',
            groupable: false,
          },
          {
            display_name: 'Promotion Name',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.promotion_dimension.promotion_name',
            groupable: false,
          },
          {
            display_name: 'Coupon Type',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.promotion_dimension.coupon_type',
            groupable: false,
          },
          {
            display_name: 'Price Reduction Type',
            type: 'STRING',
            multi_series: false,
            is_visible: true,
            name: 'public.promotion_dimension.price_reduction_type',
            groupable: false,
          },
        ],
        rows: [
          [
            1658793600,
            4662670,
            'Thom F. Vogel',
            'Individual',
            'East',
            'MA',
            'Food',
            'Dairy',
            'Brand #381 butter milk',
            8,
            208,
            'Summer Super Sale',
            'Pennysaver',
            '3 for price of 2',
          ],
          [
            1658793600,
            4662677,
            'Tanya U. Sanchez',
            'Individual',
            'East',
            'MA',
            'Medical',
            'Pharmacy',
            'Brand #26 sleeping pills',
            6,
            388,
            'July 4th Cool Sale',
            'Pennysaver',
            'Half Price',
          ],
          [
            1658793600,
            4662702,
            'Robert H. Campbell',
            'Individual',
            'East',
            'TN',
            'Food',
            'Seafood',
            'Brand #403 haddock',
            9,
            314,
            'Winter Cool Promotion',
            'Register Receipt',
            '3 for price of 2',
          ],
          [
            1658793600,
            4662695,
            'William R. Nguyen',
            'Individual',
            'East',
            'SC',
            'Misc',
            'Gifts',
            'Brand #462 electric razor',
            1,
            538,
            'Christmas Discount Sale',
            'Email',
            'Half Price',
          ],
          [
            1658793600,
            4662637,
            'Juanita E. Stein',
            'Individual',
            'East',
            'CT',
            'Non-food',
            'Cleaning supplies',
            'Brand #236 feather duster',
            10,
            487,
            'Summer Super Promotion',
            'Post',
            'Half Price',
          ],
          [
            1658793600,
            4662662,
            'Luigi A. Miller',
            'Individual',
            'East',
            'MA',
            'Non-food',
            'Liquor',
            'Brand #188 vodka',
            5,
            436,
            'Winter Liquidation Sellathon',
            'Post',
            'Half Price',
          ],
          [
            1658793600,
            4662710,
            'Emily E. Brown',
            'Individual',
            'East',
            'CT',
            'Food',
            'Bakery',
            'Brand #272 english muffins',
            8,
            248,
            'Christmas Discount Sellathon',
            'Post',
            '3 for price of 2',
          ],
          [
            1658793600,
            4662648,
            'Duncan F. Robinson',
            'Individual',
            'East',
            'NH',
            'Food',
            'Frozen Goods',
            'Brand #51 frozen chicken patties',
            1,
            320,
            'July 4th Liquidation Promotion',
            'Email',
            'Two for one',
          ],
          [
            1658793600,
            4662674,
            'Craig K. Carcetti',
            'Individual',
            'East',
            'TN',
            'Food',
            'Frozen Goods',
            'Brand #131 frozen chicken patties',
            5,
            426,
            'Thanksgiving Liquidation Sellathon',
            'Phone book',
            'Half Price',
          ],
          [
            1658793600,
            4662636,
            'Amy V. Weaver',
            'Individual',
            'East',
            'CT',
            'Non-food',
            'Liquor',
            'Brand #317 white wine',
            6,
            340,
            'Christmas Mega Sellathon',
            'Pennysaver',
            '3 for price of 2',
          ],
        ],
        session_locked_conditions: [],
        query_id: 'q_Bvk6t-xcSR-tmNK9wtKo1Q',
        parsed_interpretation: [
          {
            c_type: 'PREFIX',
            eng: 'all',
          },
          {
            c_type: 'SEED',
            eng: 'online sales',
          },
          {
            c_type: 'FILTER',
            eng: "'East' (Customer Region)",
          },
        ],
        row_limit: 50,
        condition_filter: ['East'],
      },
      reference_id: '1.1.210',
    },
  },
]
