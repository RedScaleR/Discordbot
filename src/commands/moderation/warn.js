const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { cuteEmbed, success, oops, bold } = require('../../util/cute');
const { checkHierarchy } = require('../../util/moderation');
const { logModAction } = require('../../util/logger');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Give someone a warning')
    .addUserOption((o) => o.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('What did they do?').setRequired(true).setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');

    if (!member) return interaction.reply({ embeds: [oops("They're not in the server")], flags: MessageFlags.Ephemeral });
    if (member.user.bot) return interaction.reply({ embeds: [oops("Bots don't learn from warnings")], flags: MessageFlags.Ephemeral });
    const problem = checkHierarchy(interaction, member, 'warn');
    if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });

    const id = db.addWarning(interaction.guildId, member.id, interaction.user.id, reason);
    const total = db.countWarnings(interaction.guildId, member.id);

    await member
      .send({ embeds: [cuteEmbed({ color: 'peach', description: `You got a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}` })] })
      .catch(() => {});
    await interaction.reply({
      embeds: [success(`${bold(member.user)} has been warned (warning #${id}). They have **${total}** warning${total === 1 ? '' : 's'} now`)],
    });
    await logModAction(interaction.guild, {
      action: 'Warning',
      emoji: '⚠️',
      target: member.user,
      moderator: interaction.user,
      reason,
      extra: [{ name: 'Total warnings', value: String(total), inline: true }],
    });
  },
};
