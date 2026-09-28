const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, pick, truncate } = require('../../util/cute');

const ANSWERS = [
  'Yes, definitely! (ﾉ◕ヮ◕)ﾉ',
  'It is certain :3',
  'Without a doubt~',
  'Mochi says yes! (｡•ᴗ•｡)',
  'Signs point to yes ✨',
  'Most likely :>',
  'The stars say yes ☆',
  'Hmm... ask again later (・・?)',
  "I'm too sleepy to answer right now (－\\_－) zzZ",
  'Better not tell you now :V',
  "Can't predict that one \\*.\\*",
  'Concentrate and ask again (๑•̀ㅂ•́)و',
  "Don't count on it :<",
  'My reply is no (｡•́︿•̀｡)',
  'Nope nope nope ✗',
  'Very doubtful (¬\\_¬)',
  'Outlook not so good >\\_<',
  'Absolutely not, silly!',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic mochi ball a yes/no question')
    .addStringOption((o) => o.setName('question').setDescription('What do you want to know?').setRequired(true).setMaxLength(250)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    await interaction.reply({
      embeds: [
        cuteEmbed({
          title: '🎱 The magic mochi ball says...',
          fields: [
            { name: 'You asked', value: truncate(question) },
            { name: 'Answer', value: pick(ANSWERS) },
          ],
          color: 'lavender',
        }),
      ],
    });
  },
};
