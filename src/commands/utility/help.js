const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { cuteEmbed } = require('../../util/cute');

const CATEGORIES = {
  fun: '🎲 Fun & Games',
  economy: '🍡 Levels & Economy',
  utility: '🧰 Utility',
  moderation: '🔨 Moderation',
  admin: '⚙️ Admin',
};

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('See everything Mochi can do'),

  async execute(interaction) {
    const fields = Object.entries(CATEGORIES)
      .map(([category, label]) => {
        const lines = interaction.client.commands
          .filter((command) => command.category === category)
          .map((command) => `\`/${command.data.name}\` ${command.data.description}`);
        return { name: label, value: lines.join('\n') };
      })
      .filter((field) => field.value);

    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: "Hi, I'm Mochi! (◕‿◕)",
          description: "Here's everything I can do. Chat to earn XP and level up! :3",
          fields,
          thumbnail: interaction.client.user.displayAvatarURL(),
          footer: 'Moderation and admin commands only show up for people with the right permissions',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
