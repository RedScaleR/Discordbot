const { SlashCommandBuilder, MessageFlags, time, TimestampStyles } = require('discord.js');
const { cuteEmbed, oops, pick, randomInt, kao } = require('../../util/cute');
const config = require('../../config');
const db = require('../../database');

// {amount} gets replaced with the coins earned.
const JOBS = [
  'You baked a batch of fresh mochi at the bakery and earned {amount}',
  'You pet cats at the cat café all afternoon and got paid {amount}',
  'You walked five very excited dogs and earned {amount}',
  'You streamed for three hours and got {amount} in donations',
  "You fixed a bug in someone's code and they paid you {amount}",
  'You sold handmade plushies at the market and made {amount}',
  'You delivered pizza (and only ate one slice) for {amount}',
  'You won a karaoke contest and took home {amount}',
  'You watered all the plants in the botanical garden for {amount}',
  'You helped a lost duckling find its family and a stranger tipped you {amount}',
];

module.exports = {
  data: new SlashCommandBuilder().setName('work').setDescription('Do a cute little job to earn some coins'),

  async execute(interaction) {
    const { workMin, workMax, workCooldownMinutes, currency } = config.economy;
    const member = db.getMember(interaction.guildId, interaction.user.id);
    const now = Date.now();
    const nextWork = member.last_work_at + workCooldownMinutes * 60 * 1000;

    if (now < nextWork) {
      return interaction.reply({
        embeds: [oops(`You're tired from your last job! Rest up and try again ${time(new Date(nextWork), TimestampStyles.RelativeTime)}`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const amount = randomInt(workMin, workMax);
    db.claimWork(interaction.guildId, interaction.user.id, amount, now);

    const story = pick(JOBS).replace('{amount}', `**${amount} ${currency}**`);
    await interaction.reply({ embeds: [cuteEmbed({ description: `💼 ${story}! ${kao('happy')}`, color: 'mint' })] });
  },
};
