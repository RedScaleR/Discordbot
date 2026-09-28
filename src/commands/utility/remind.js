const { SlashCommandBuilder, MessageFlags, time, TimestampStyles } = require('discord.js');
const { success, oops } = require('../../util/cute');
const { parseDuration } = require('../../util/duration');
const db = require('../../database');

const MAX_DELAY = 365 * 24 * 60 * 60 * 1000;
const MAX_REMINDERS = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription("Mochi will remind you about something later")
    .addStringOption((o) => o.setName('in').setDescription('When, like 10m, 2h or 3d').setRequired(true))
    .addStringOption((o) => o.setName('about').setDescription('What should I remind you about?').setRequired(true).setMaxLength(500)),

  async execute(interaction) {
    const delay = parseDuration(interaction.options.getString('in'));
    const about = interaction.options.getString('about');

    if (!delay || delay > MAX_DELAY) {
      return interaction.reply({
        embeds: [oops('Tell me when like `10m`, `2h` or `3d` (up to a year)')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (db.countReminders(interaction.user.id) >= MAX_REMINDERS) {
      return interaction.reply({
        embeds: [oops(`You already have ${MAX_REMINDERS} reminders waiting. That's a lot to remember!`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const remindAt = Date.now() + delay;
    db.addReminder(interaction.user.id, interaction.channelId, about, remindAt);
    await interaction.reply({
      embeds: [success(`Got it! I'll remind you ${time(new Date(remindAt), TimestampStyles.RelativeTime)}`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
