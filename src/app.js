const express = require('express');
const bodyParser = express.json();
const route = require('./routes');

const app = express();

app.use(bodyParser);

// basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use('/api', route);

// health
app.get('/', (req, res) => res.send('Smart Routine Optimizer API is running.'));

module.exports = app;
