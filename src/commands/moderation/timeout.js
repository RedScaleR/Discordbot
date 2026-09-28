const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, success, oops, bold } = require('../../util/cute');
const { checkHierarchy, auditReason, MISSING_PERMS_HINT } = require('../../util/moderation');
const { parseDuration, formatDuration } = require('../../util/duration');
const { logModAction } = require('../../util/logger');

const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription("Put someone in timeout so they can't talk for a while")
    .addUserOption((o) => o.setName('user').setDescription('Who to time out').setRequired(true))
    .addStringOption((o) =>
      o.setName('duration').setDescription('How long, like 10m, 1h or 2d (max 28d)').setRequired(true),
    )
    .addStringOption((o) => o.setName('reason').setDescription('Why are they being timed out?').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const duration = parseDuration(interaction.options.getString('duration'));
    const reason = interaction.options.getString('reason') ?? 'No reason given';

    if (!member) return interaction.reply({ embeds: [oops("They're not in the server")], flags: MessageFlags.Ephemeral });
    if (!duration || duration > MAX_TIMEOUT) {
      return interaction.reply({
        embeds: [oops('Give me a duration like `10m`, `1h` or `2d` (28 days at most)')],
        flags: MessageFlags.Ephemeral,
      });
    }
    const problem = checkHierarchy(interaction, member, 'time out');
    if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
    if (!member.moderatable) {
      return interaction.reply({
        embeds: [oops(`${MISSING_PERMS_HINT} (admins can't be timed out at all)`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await member.timeout(duration, auditReason(interaction, reason));
    const endsAt = new Date(Date.now() + duration);
    await member
      .send({
        embeds: [
          cuteEmbed({
            color: 'peach',
            description: `You were timed out in **${interaction.guild.name}** until ${time(endsAt, TimestampStyles.LongDateTime)}.\n**Reason:** ${reason}`,
          }),
        ],
      })
      .catch(() => {});

    await interaction.reply({
      embeds: [success(`${bold(member.user)} is in timeout for **${formatDuration(duration)}**. Think about what you did!`)],
    });
    await logModAction(interaction.guild, {
      action: 'Timeout',
      emoji: '⏳',
      target: member.user,
      moderator: interaction.user,
      reason,
      extra: [{ name: 'Until', value: time(endsAt, TimestampStyles.RelativeTime), inline: true }],
    });
  },
};
