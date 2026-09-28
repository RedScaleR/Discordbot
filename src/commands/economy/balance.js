const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, bold, kao } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check how many coins you (or someone else) have')
    .addUserOption((o) => o.setName('user').setDescription('Whose wallet? (defaults to you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const { coins } = db.getMember(interaction.guildId, user.id);
    const mood = coins === 0 ? kao('sad') : coins >= 5000 ? `rich! ${kao('shock')}` : kao('happy');

    await interaction.reply({
      embeds: [
        cuteEmbed({
          description: `👛 ${bold(user)} has **${coins.toLocaleString()} ${config.economy.currency}** ${mood}`,
          thumbnail: user.displayAvatarURL(),
          color: 'peach',
        }),
      ],
    });
  },
};
