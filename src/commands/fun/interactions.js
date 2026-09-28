const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, pick } = require('../../util/cute');

// Each action becomes its own slash command. Add more here if you like!
// {a} is the person using the command, {b} is the person they picked.
const ACTIONS = {
  hug: {
    description: 'Give someone a warm hug',
    emoji: '🤗',
    lines: ['{a} gives {b} a big warm hug! (っ◔◡◔)っ ♥', '{a} squeezes {b} tight~ (づ｡◕‿‿◕｡)づ', '{a} wraps {b} in the coziest hug ever ♡'],
    self: 'Mochi gives {a} a hug, because everyone deserves one (っ◔◡◔)っ ♥',
    bot: '\\*hugs {a} back\\* hehe, thank you :3',
  },
  pat: {
    description: 'Pat someone on the head',
    emoji: '🫳',
    lines: ['{a} pats {b} on the head. Good job! (˶ᵔ ᵕ ᵔ˶)', '{a} gives {b} gentle headpats~ :3', 'pat pat pat! {a} pats {b} (｡•ᴗ•｡)'],
    self: '{a} pats themself on the head. You did great today! :>',
    bot: '\\*leans into the pats\\* (≧◡≦)',
  },
  boop: {
    description: "Boop someone's nose",
    emoji: '👉',
    lines: ["{a} boops {b}'s nose! Boop! :3", '{a} sneaks up and boops {b} (｡•̀ᴗ-)✧', "boop! {a} got {b} right on the snoot :V"],
    self: '{a} boops their own nose... how? \\*.\\*',
    bot: 'H-hey! \\*scrunches nose\\* (>ω<)',
  },
  highfive: {
    description: 'High five someone',
    emoji: '✋',
    lines: ['{a} and {b} high five! ✋ Nice! (ﾉ◕ヮ◕)ﾉ', '{a} gives {b} the loudest high five! ᕙ(＾▿＾)ᕗ', 'Up high! {a} high fives {b} :>'],
    self: '{a} high fives themself. Self-love! (✿◠‿◠)',
    bot: '\\*jumps up for the high five\\* ✋ yay! :3',
  },
};

module.exports = Object.entries(ACTIONS).map(([name, action]) => ({
  data: new SlashCommandBuilder()
    .setName(name)
    .setDescription(action.description)
    .addUserOption((o) => o.setName('user').setDescription('Who?').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    let template = pick(action.lines);
    if (target.id === interaction.user.id) template = action.self;
    else if (target.id === interaction.client.user.id) template = action.bot;

    const text = template.replaceAll('{a}', `${interaction.user}`).replaceAll('{b}', `${target}`);
    await interaction.reply({ embeds: [cuteEmbed({ description: `${action.emoji} ${text}` })] });
  },
}));
