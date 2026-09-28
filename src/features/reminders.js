const db = require('../database');

const CHECK_EVERY = 10_000;

async function deliver(client, reminder) {
  const late = Date.now() - reminder.remind_at > 60_000;
  const content =
    `⏰ <@${reminder.user_id}>, you asked me to remind you: ${reminder.message}` +
    (late ? "\n(sorry I'm late, I was asleep! (｡•́︿•̀｡))" : '');
  const options = { content, allowedMentions: { users: [reminder.user_id] } };

  const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
  if (channel?.isTextBased()) {
    const sent = await channel.send(options).catch(() => null);
    if (sent) return;
  }
  // Can't post in the original channel anymore, so try their DMs instead.
  const user = await client.users.fetch(reminder.user_id).catch(() => null);
  await user?.send(options).catch(() => {});
}

function startReminders(client) {
  let running = false;
  const tick = async () => {
    // A slow batch shouldn't overlap with the next check, or reminders could be sent twice.
    if (running) return;
    running = true;
    try {
      for (const reminder of db.dueReminders()) {
        db.deleteReminder(reminder.id);
        await deliver(client, reminder).catch((err) => console.warn(`[reminders] ${err.message}`));
      }
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, CHECK_EVERY);
}

module.exports = { startReminders };
