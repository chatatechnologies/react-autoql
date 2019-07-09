const React = require('react')
const express = require('express')
const ReactDOM = require('react-dom/server')
const { ChatDrawer } = require('@chata-ai/core')

const app = express()
const port = 3000

app.get('*', (req, res) => {
  // const props = {
  //   config: 'THIS IS A TEST'
  // }
  const html = ReactDOM.renderToString(React.createElement(ChatDrawer))

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
    </head>
    <body>
      ${html}
    </body>
    </html>
  `)
})

app.listen(port, () => console.log(`http://localhost:${port}`))
