const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { success, oops } = require('../../util/cute');
const { formatDuration } = require('../../util/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set how long people have to wait between messages in this channel')
    .addIntegerOption((o) =>
      o
        .setName('seconds')
        .setDescription('Seconds between messages (0 turns it off, max 21600 = 6 hours)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const { channel } = interaction;

    if (!channel?.setRateLimitPerUser) {
      return interaction.reply({ embeds: [oops("Slowmode doesn't work in this kind of channel")], flags: MessageFlags.Ephemeral });
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.username}`);
    await interaction.reply({
      embeds: [success(seconds ? `Slowmode is on: one message every **${formatDuration(seconds * 1000)}**. Slow down, speedy` : 'Slowmode is off. Chat away!')],
    });
  },
};
