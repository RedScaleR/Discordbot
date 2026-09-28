const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { cuteEmbed, success, oops, bold } = require('../../util/cute');
const { checkHierarchy, auditReason, MISSING_PERMS_HINT } = require('../../util/moderation');
const { logModAction, expectEvent } = require('../../util/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban someone from the server')
    .addUserOption((o) => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why are they being banned?').setMaxLength(400))
    .addIntegerOption((o) =>
      o
        .setName('delete_messages')
        .setDescription('Also delete their recent messages')
        .addChoices(
          { name: "Don't delete any", value: 0 },
          { name: 'Last hour', value: 60 * 60 },
          { name: 'Last 24 hours', value: 24 * 60 * 60 },
          { name: 'Last 7 days', value: 7 * 24 * 60 * 60 },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const deleteMessageSeconds = interaction.options.getInteger('delete_messages') ?? 0;

    // They might not be in the server anymore, which is fine: you can still ban them.
    if (member) {
      const problem = checkHierarchy(interaction, member, 'ban');
      if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
      if (!member.bannable) return interaction.reply({ embeds: [oops(MISSING_PERMS_HINT)], flags: MessageFlags.Ephemeral });

      await user
        .send({
          embeds: [cuteEmbed({ color: 'red', description: `You were banned from **${interaction.guild.name}**.\n**Reason:** ${reason}` })],
        })
        .catch(() => {});
    }

    expectEvent(`ban:${interaction.guildId}:${user.id}`);
    await interaction.guild.members.ban(user, { reason: auditReason(interaction, reason), deleteMessageSeconds });
    await interaction.reply({ embeds: [success(`${bold(user)} has been banned. Bye bye!`)] });
    await logModAction(interaction.guild, { action: 'Ban', emoji: '🔨', target: user, moderator: interaction.user, reason });
  },
};
