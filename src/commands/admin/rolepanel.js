const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { cuteEmbed, success, oops } = require('../../util/cute');
const { selfRoleProblem } = require('../../util/moderation');

const MAX_ROLES = 10;
const BUTTONS_PER_ROW = 5;

const data = new SlashCommandBuilder()
  .setName('rolepanel')
  .setDescription('Post a panel of buttons people can click to give themselves roles')
  .addStringOption((o) => o.setName('title').setDescription('Panel title, like "Pick your colors!"').setRequired(true).setMaxLength(200))
  .addRoleOption((o) => o.setName('role1').setDescription('A role people can pick').setRequired(true));
for (let i = 2; i <= MAX_ROLES; i++) {
  data.addRoleOption((o) => o.setName(`role${i}`).setDescription('Another role people can pick'));
}
data
  .addStringOption((o) => o.setName('description').setDescription('Extra text under the title').setMaxLength(1000))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

module.exports = {
  data,
  buttonPrefix: 'role',

  async execute(interaction) {
    const roles = [];
    for (let i = 1; i <= MAX_ROLES; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role && !roles.some((r) => r.id === role.id)) roles.push(role);
    }

    for (const role of roles) {
      const problem = selfRoleProblem(role);
      if (problem) return interaction.reply({ embeds: [oops(problem)], flags: MessageFlags.Ephemeral });
      if (interaction.user.id !== interaction.guild.ownerId && role.position >= interaction.member.roles.highest.position) {
        return interaction.reply({ embeds: [oops(`${role} is higher than your own top role`)], flags: MessageFlags.Ephemeral });
      }
    }

    if (!interaction.channel?.send) {
      return interaction.reply({ embeds: [oops("I can't post a panel in this kind of channel")], flags: MessageFlags.Ephemeral });
    }

    const rows = [];
    for (let i = 0; i < roles.length; i += BUTTONS_PER_ROW) {
      rows.push(
        new ActionRowBuilder().addComponents(
          roles.slice(i, i + BUTTONS_PER_ROW).map((role) =>
            new ButtonBuilder().setCustomId(`role:${role.id}`).setLabel(role.name.slice(0, 80)).setStyle(ButtonStyle.Secondary),
          ),
        ),
      );
    }

    const description = interaction.options.getString('description') ?? 'Click a button to get a role. Click it again to remove it! :3';
    await interaction.channel.send({
      embeds: [cuteEmbed({ title: interaction.options.getString('title'), description })],
      components: rows,
    });
    await interaction.reply({ embeds: [success('Role panel posted!')], flags: MessageFlags.Ephemeral });
  },

  /** Runs when someone clicks a role button, even long after the panel was posted. */
  async handleButton(interaction) {
    const role = interaction.guild.roles.cache.get(interaction.customId.split(':')[1]);
    const problem = selfRoleProblem(role);
    if (problem) {
      return interaction.reply({ embeds: [oops(`${problem}. Ask an admin to fix this panel`)], flags: MessageFlags.Ephemeral });
    }

    const { member } = interaction;
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Role panel');
      return interaction.reply({ embeds: [success(`Took away ${role}`)], flags: MessageFlags.Ephemeral });
    }
    await member.roles.add(role, 'Role panel');
    await interaction.reply({ embeds: [success(`You got ${role}!`)], flags: MessageFlags.Ephemeral });
  },
};
