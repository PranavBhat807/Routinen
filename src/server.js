require('dotenv').config();
const app = require('./app');
const config = require('./config');

const PORT = config.port || 3000;

// start cron jobs (optional)
try {
  const cronRunner = require('./cron/scheduler');
  cronRunner.startCronJobs();
} catch (err) {
  console.warn('Cron initialization skipped or failed:', err.message);
}

app.listen(PORT, () => {
  console.log(`🚀 Smart Routine Optimizer API listening on http://localhost:${PORT}`);
});
