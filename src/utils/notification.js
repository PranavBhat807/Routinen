const notifier = require('node-notifier');
const path = require('path');

/**
 * Sends a desktop notification
 * @param {string} title - Notification title
 * @param {string} message - Notification messageBody
 * @param {boolean} [sound=true] - Whether to play a sound
 */
function sendNotification(title, message, sound = true) {
  try {
    notifier.notify({
      title: title || 'Smart Routine Optimiser',
      message: message,
      sound: sound, // true | false | 'Frog' | 'Sosumi' | 'Bottle' (macOS)
      wait: false, // Wait with callback, until user action is taken against notification
      appID: 'Smart Routine Optimiser' // Windows specific
    }, (err, response) => {
      // Response is response from notification
      if (err) {
        console.error('Notification error:', err);
      }
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

module.exports = { sendNotification };
