const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { success, oops } = require('../../util/cute');
const { sendLog } = require('../../util/logger');
const { record } = require('../../activity');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete recent messages in this channel')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How many messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this person'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    const { channel } = interaction;

    if (!channel?.bulkDelete) {
      return interaction.reply({ embeds: [oops("I can't bulk delete in this kind of channel")], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let messages = await channel.messages.fetch({ limit: user ? 100 : amount });
    if (user) messages = messages.filter((m) => m.author.id === user.id).first(amount);

    // Discord only allows bulk deleting messages younger than 14 days; `true` skips older ones.
    const deleted = await channel.bulkDelete(messages, true);
    const skipped = (user ? messages.length : messages.size) - deleted.size;

    await interaction.editReply({
      embeds: [
        success(
          `Swept away **${deleted.size}** message${deleted.size === 1 ? '' : 's'}` +
            (skipped ? ` (${skipped} were older than 14 days, so Discord won't let me)` : ''),
        ),
      ],
    });
    if (deleted.size) {
      record(interaction.guildId, 'mod', `${interaction.user.username} purged ${deleted.size} messages in #${channel.name}`);
      await sendLog(interaction.guild, {
        title: '🧹 Messages purged',
        color: 'peach',
        fields: [
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Moderator', value: `${interaction.user}`, inline: true },
          { name: 'Amount', value: String(deleted.size), inline: true },
          ...(user ? [{ name: 'From', value: `${user}`, inline: true }] : []),
        ],
      });
    }
  },
};
