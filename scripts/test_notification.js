const { sendNotification } = require('../src/utils/notification');

console.log('Sending test notification...');
sendNotification('Test Notification', 'This is a test notification from Smart Routine Optimiser', true);
console.log('Notification sent (check your desktop).');
