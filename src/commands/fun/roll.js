const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { cuteEmbed, oops, randomInt, kao } = require('../../util/cute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll some dice')
    .addStringOption((o) => o.setName('dice').setDescription('Like d6, 2d20 or 3d8+2 (default: 1d6)').setMaxLength(20)),

  async execute(interaction) {
    const input = (interaction.options.getString('dice') ?? '1d6').replace(/\s+/g, '').toLowerCase();
    const match = input.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    const count = Number(match?.[1] || 1);
    const sides = Number(match?.[2]);
    const modifier = Number(match?.[3] ?? 0);

    if (!match || count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return interaction.reply({
        embeds: [oops('Try something like `d6`, `2d20` or `3d8+2` (up to 100 dice with up to 1000 sides)')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const rolls = Array.from({ length: count }, () => randomInt(1, sides));
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
    const shown = count <= 25 ? `[${rolls.join(', ')}]` : `${count} dice`;
    const modText = modifier ? ` ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}` : '';

    let flavor = kao('happy');
    if (count === 1 && rolls[0] === sides) flavor = 'CRITICAL HIT! (ﾉ◕ヮ◕)ﾉ✧';
    else if (count === 1 && rolls[0] === 1) flavor = 'oof... (╥﹏╥)';

    await interaction.reply({
      embeds: [cuteEmbed({ title: `🎲 ${input}`, description: `${shown}${modText} = **${total}**\n${flavor}` })],
    });
  },
};
