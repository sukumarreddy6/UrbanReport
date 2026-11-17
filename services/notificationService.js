const Notification = require('../models/Notification');

async function notify(userId, complaintId, message, href) {
  if (!userId) return;
  await Notification.create({ userId, complaintId, message, href });
}

module.exports = { notify };
