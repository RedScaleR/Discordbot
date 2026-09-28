const { SlashCommandBuilder } = require('discord.js');
const { cuteEmbed, pick } = require('../../util/cute');
const { fetchGif } = require('../../util/gifs');

// Each action becomes its own slash command. Add more here if you like!
// {a} is the person using the command, {b} is the person they picked.
// `gif` is a GIF category (see src/util/gifs.js for which sites have which).
const ACTIONS = {
  hug: {
    gif: 'hug',
    description: 'Give someone a warm hug',
    emoji: '🤗',
    lines: ['{a} gives {b} a big warm hug! (っ◔◡◔)っ ♥', '{a} squeezes {b} tight~ (づ｡◕‿‿◕｡)づ', '{a} wraps {b} in the coziest hug ever ♡'],
    self: 'Mochi gives {a} a hug, because everyone deserves one (っ◔◡◔)っ ♥',
    bot: '\\*hugs {a} back\\* hehe, thank you :3',
  },
  pat: {
    gif: 'pat',
    description: 'Pat someone on the head',
    emoji: '🫳',
    lines: ['{a} pats {b} on the head. Good job! (˶ᵔ ᵕ ᵔ˶)', '{a} gives {b} gentle headpats~ :3', 'pat pat pat! {a} pats {b} (｡•ᴗ•｡)'],
    self: '{a} pats themself on the head. You did great today! :>',
    bot: '\\*leans into the pats\\* (≧◡≦)',
  },
  boop: {
    gif: 'poke',
    description: "Boop someone's nose",
    emoji: '👉',
    lines: ["{a} boops {b}'s nose! Boop! :3", '{a} sneaks up and boops {b} (｡•̀ᴗ-)✧', 'boop! {a} got {b} right on the snoot :V'],
    self: '{a} boops their own nose... how? \\*.\\*',
    bot: 'H-hey! \\*scrunches nose\\* (>ω<)',
  },
  highfive: {
    gif: 'highfive',
    description: 'High five someone',
    emoji: '✋',
    lines: ['{a} and {b} high five! ✋ Nice! (ﾉ◕ヮ◕)ﾉ', '{a} gives {b} the loudest high five! ᕙ(＾▿＾)ᕗ', 'Up high! {a} high fives {b} :>'],
    self: '{a} high fives themself. Self-love! (✿◠‿◠)',
    bot: '\\*jumps up for the high five\\* ✋ yay! :3',
  },
  cuddle: {
    gif: 'cuddle',
    description: 'Cuddle up with someone',
    emoji: '🧸',
    lines: ['{a} cuddles up with {b}~ so cozy (´｡• ᵕ •｡`) ♡', '{a} and {b} are having a cuddle puddle :3', '{a} snuggles {b} like a warm mochi ♡'],
    self: '{a} cuddles a pillow. Mochi joins in! (っ˘ω˘ς)',
    bot: '\\*snuggles into {a}\\* warm and squishy :3',
  },
  wave: {
    gif: 'wave',
    description: 'Wave at someone',
    emoji: '👋',
    lines: ['{a} waves at {b}! Hiii (^▽^)/', '{a} waves both arms at {b} excitedly ヾ(＾∇＾)', '{b}! {a} is waving at you :>'],
    self: '{a} waves at the mirror. Hi, cutie! (✿◠‿◠)',
    bot: '\\*waves back at {a}\\* hiii :3',
  },
  bonk: {
    gif: 'bonk',
    description: 'Bonk someone (lovingly)',
    emoji: '🔨',
    lines: ['{a} bonks {b}! Behave! :V', 'BONK! {a} bonks {b} on the head (｀へ´)', '{a} lovingly bonks {b} with a squeaky hammer'],
    self: '{a} bonks themself. Why?? \\*.\\*',
    bot: 'Ow! Why would you bonk me, {a}?! (╥﹏╥)',
  },
  slap: {
    gif: 'slap',
    description: 'Slap someone (for comedy)',
    emoji: '💥',
    lines: ['{a} slaps {b}! Oof (°ロ°)', '{a} gives {b} a dramatic anime slap :V', 'SLAP! {b} did NOT see that coming from {a}'],
    self: '{a} slaps themself awake. Rise and shine! ☀️',
    bot: '\\*dodges\\* too slow, {a}! (≧◡≦)',
  },
  tickle: {
    gif: 'tickle',
    description: 'Tickle someone',
    emoji: '🪶',
    lines: ['{a} tickles {b}! hehehe (≧▽≦)', '{a} attacks {b} with tickles! No escape :3', '{b} is getting tickled by {a}! Stop, stop! >w<'],
    self: '{a} tries to tickle themself. It never works :<',
    bot: 'N-no tickles! hahaha stop it {a}! (>ω<)',
  },
  bite: {
    gif: 'bite',
    description: 'Give someone a little nom',
    emoji: '😬',
    lines: ['{a} bites {b}! nom :3', '{a} gives {b} a tiny chomp (｀ω´)', '{b} got nommed by {a}! Are you a snack?'],
    self: '{a} bites their own arm... hungry? :V',
    bot: 'Hey! I am NOT a real mochi, {a}! (｡•́︿•̀｡)',
  },
  feed: {
    gif: 'feed',
    description: 'Feed someone a snack',
    emoji: '🍡',
    lines: ['{a} feeds {b} a yummy mochi! 🍡 (｡•ᴗ•｡)', '{a} shares a snack with {b}~ say ahh :3', '{b} gets fed by {a}. So sweet ♡'],
    self: '{a} treats themself to a snack. Deserved! :>',
    bot: '\\*munches happily\\* thank you {a}! (˶ᵔ ᵕ ᵔ˶)',
  },
  handhold: {
    gif: 'handhold',
    description: "Hold someone's hand",
    emoji: '🤝',
    lines: ["{a} holds {b}'s hand~ (⁄ ⁄•⁄ω⁄•⁄ ⁄)", '{a} and {b} are holding hands! How cute ♡', "{a} shyly takes {b}'s hand :3"],
    self: '{a} holds their own hand. Mochi will hold the other one ♡',
    bot: "\\*holds {a}'s hand\\* hehe (´｡• ᵕ •｡`)",
  },
  // Flirty pack
  kiss: {
    gif: 'kiss',
    description: 'Give someone a little kiss',
    emoji: '💋',
    lines: ['{a} gives {b} a kiss on the cheek! (˶ᵔ ᵕ ᵔ˶) ♡', '{a} kisses {b}~ mwah! :3', '{b} got a surprise smooch from {a} (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)'],
    self: '{a} kisses the mirror. Confidence! ✨',
    bot: 'W-what?! \\*turns bright pink\\* (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
  },
  peck: {
    gif: 'peck',
    description: 'Give someone a quick peck',
    emoji: '😚',
    lines: ['{a} gives {b} a quick peck! chu~ :3', '{a} sneaks a tiny peck on {b} (｡•̀ᴗ-)✧', 'peck! {a} got {b} :>'],
    self: '{a} pecks their own hand. Practicing? :V',
    bot: '\\*giggles\\* hehe, thank you {a} (≧◡≦)',
  },
  blowkiss: {
    gif: 'blowkiss',
    description: 'Blow someone a kiss',
    emoji: '😘',
    lines: ['{a} blows {b} a kiss! 💨💋', '{a} sends {b} a flying kiss~ catch it! :3', 'mwah~ {a} blows a kiss at {b} ♡'],
    self: '{a} blows a kiss to everyone! ♡ (ﾉ◕ヮ◕)ﾉ',
    bot: '\\*catches the kiss and keeps it\\* :3',
  },
  kabedon: {
    gif: 'kabedon',
    description: 'Pin someone against the wall, anime style',
    emoji: '🧱',
    lines: ['{a} kabedons {b} against the wall! Doki doki... (⁄ ⁄•⁄ω⁄•⁄ ⁄)', "{a} leans in close to {b}. The wall can't save you now :V", '\\*BAM\\* {a} pins {b} to the wall, anime style!'],
    self: '{a} kabedons the wall itself. The wall is flustered.',
    bot: 'H-hey! Too close, {a}! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)',
  },
  lappillow: {
    gif: 'lappillow',
    description: 'Let someone nap on your lap',
    emoji: '💤',
    lines: ['{a} lets {b} nap on their lap~ (－ω－) zzZ', '{b} rests their head on {a}\'s lap. So comfy ♡', '{a} offers {b} a lap pillow. Sweet dreams :3'],
    self: '{a} tries to use their own lap as a pillow. Flexible!',
    bot: '\\*curls up on {a}\'s lap\\* zzZ :3',
  },
  carry: {
    gif: 'carry',
    description: 'Carry someone around',
    emoji: '🫶',
    lines: ['{a} princess-carries {b}! (ﾉ◕ヮ◕)ﾉ', '{a} scoops {b} up and carries them away~', '{b} is being carried by {a}. Wheee! :3'],
    self: '{a} tries to carry themself. Physics says no :V',
    bot: '\\*gets carried by {a}\\* wheee! (≧◡≦)',
  },

  // Chaos pack
  punch: {
    gif: 'punch',
    description: 'Punch someone (cartoon style)',
    emoji: '👊',
    lines: ['{a} punches {b}! POW! (ง •̀\\_•́)ง', '{a} throws a cartoon punch at {b}. K.O.!', 'ORA ORA! {a} punches {b} :V'],
    self: '{a} punches the air. Take that, air! (ง •̀\\_•́)ง',
    bot: '\\*blocks with a mochi shield\\* nice try, {a}! :3',
  },
  dropkick: {
    gif: 'kick',
    description: 'Dropkick someone (cartoon style)',
    emoji: '🦵',
    lines: ['{a} dropkicks {b}! Hi-yah! :V', '{a} does a flying dropkick on {b} (ﾉ｀Д´)ﾉ', '{b} got dropkicked by {a}!'],
    self: '{a} tries to dropkick themself and falls over (╥﹏╥)',
    bot: '\\*bounces away like a rubber ball\\* boing! :3',
  },
  yeet: {
    gif: 'yeet',
    description: 'Yeet someone into the sun',
    emoji: '🌞',
    lines: ['{a} YEETS {b} into the sun! ☀️', '{b} has been yeeted by {a}. Goodbye! (ﾉ◕ヮ◕)ﾉ', 'YEET! {a} launched {b} into orbit :V'],
    self: '{a} yeets themself out of the chat. Bye!',
    bot: 'You can\'t yeet me, {a}! I am too squishy! \\*bounces back\\*',
  },
  shoot: {
    gif: 'shoot',
    description: 'Finger-gun someone',
    emoji: '👉',
    lines: ['{a} finger-guns {b}! Pew pew! (☞ﾟヮﾟ)☞', "{a} shoots {b} with a water pistol! Splash :V", '{a} points at {b}: bang! ...{b} dramatically falls over'],
    self: '{a} finger-guns the mirror. Looking good! (☞ﾟヮﾟ)☞',
    bot: '\\*dramatically falls over\\* tell my friends... I loved them :V',
  },
  tableflip: {
    gif: 'tableflip',
    description: 'Flip a table at someone',
    emoji: '🪑',
    lines: ['{a} flips a table at {b}! (╯°□°)╯︵ ┻━┻', '{a} is SO done with {b}. (ノಠ益ಠ)ノ彡┻━┻', '{b} made {a} flip the table! ┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻'],
    self: '{a} flips a table (╯°□°)╯︵ ┻━┻ ...then puts it back ┬─┬ノ( º \\_ ºノ)',
    bot: '\\*puts the table back\\* ┬─┬ノ( º \\_ ºノ) calm down, {a} :3',
  },
  baka: {
    gif: 'baka',
    description: 'Call someone a baka',
    emoji: '💢',
    lines: ['{a} calls {b} a BAKA! (｀へ´)', 'Baka baka baka! {a} is mad at {b} :<', '{a}: "{b}, you... BAKA!" (╬ Ò﹏Ó)'],
    self: '{a} calls themself a baka. Be nice to yourself! :<',
    bot: "I'm not a baka, YOU'RE a baka, {a}! (｀へ´)",
  },
  bleh: {
    gif: 'bleh',
    description: 'Stick your tongue out at someone',
    emoji: '😛',
    lines: ['{a} sticks their tongue out at {b}! Bleh! :P', '{a} goes bleeeh at {b} (｡•̀ᴗ-)✧', '{b} got a bleh from {a} :V'],
    self: '{a} sticks their tongue out at the mirror. Bleh! :P',
    bot: '\\*sticks tongue out back at {a}\\* bleeeh :P',
  },
};

// /emote moods. `gif` is the category, {a} is the person using it.
const EMOTES = {
  happy: { gif: 'happy', emoji: '😊', lines: ['{a} is super happy today! (ﾉ◕ヮ◕)ﾉ', '{a} is beaming with joy :3'] },
  dance: { gif: 'dance', emoji: '💃', lines: ['{a} is dancing! ♪(┌・。・)┌', '{a} busts out their best moves ᕕ( ᐛ )ᕗ'] },
  cry: { gif: 'cry', emoji: '😭', lines: ['{a} is crying (╥﹏╥) someone hug them!', '{a} needs a tissue... (｡•́︿•̀｡)'] },
  blush: { gif: 'blush', emoji: '😳', lines: ['{a} is blushing! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', "{a}'s cheeks turned pink :3"] },
  laugh: { gif: 'laugh', emoji: '😂', lines: ['{a} is laughing so hard! (≧▽≦)', '{a} cannot stop giggling hehehe'] },
  smug: { gif: 'smug', emoji: '😏', lines: ['{a} looks very smug right now (¬‿¬)', "{a} knows something you don't :V"] },
  pout: { gif: 'pout', emoji: '😤', lines: ['{a} is pouting (｀へ´)', '{a} puffs their cheeks. Hmph! :<'] },
  angry: { gif: 'angry', emoji: '💢', lines: ['{a} is angy (╬ Ò﹏Ó)', '{a} is fuming! Someone bring snacks, quick'] },
  sleep: { gif: 'sleep', emoji: '💤', lines: ['{a} is sleeping... zzZ (－ω－) zzZ', '{a} dozed off. Shhh!'] },
  yawn: { gif: 'yawn', emoji: '🥱', lines: ['{a} yawns... sleepy time? (－ω－)', '{a} lets out a huge yawn'] },
  shrug: { gif: 'shrug', emoji: '🤷', lines: ['{a} shrugs ¯\\\\\\_(ツ)\\_/¯', '{a} has no idea, honestly ¯\\\\\\_(ツ)\\_/¯'] },
  facepalm: { gif: 'facepalm', emoji: '🤦', lines: ['{a} facepalms (－‸ლ)', '{a} cannot believe what just happened'] },
  think: { gif: 'think', emoji: '🤔', lines: ['{a} is thinking really hard... (・・?)', "{a}'s brain is loading..."] },
  thumbsup: { gif: 'thumbsup', emoji: '👍', lines: ['{a} gives a big thumbs up! (b ᵔ▽ᵔ)b', '{a} approves :>'] },
  clap: { gif: 'clap', emoji: '👏', lines: ['{a} is clapping! Bravo!', '{a} gives a round of applause (ﾉ◕ヮ◕)ﾉ'] },
  sip: { gif: 'sip', emoji: '🍵', lines: ['{a} sips their tea...', '{a} sips quietly and watches the drama :V'] },
  nom: { gif: 'nom', emoji: '🍙', lines: ['{a} is eating something yummy, nom nom :3', '{a} is having a snack break 🍡'] },
  shocked: { gif: 'shocked', emoji: '😱', lines: ['{a} is SHOCKED Σ(°△°|||)', "{a} can't believe their eyes (⊙\\_⊙)"] },
};

/** Sends an action embed, with a GIF if one can be found. */
async function replyWithGif(interaction, gifCategory, text) {
  // Fetching the GIF can take a moment, so tell Discord we're on it first.
  await interaction.deferReply();
  const gif = await fetchGif(gifCategory);
  const embed = cuteEmbed({ description: text, footer: gif?.source ? `from ${gif.source}` : undefined });
  if (gif) embed.setImage(gif.url);
  await interaction.editReply({ embeds: [embed] });
}

const actionCommands = Object.entries(ACTIONS).map(([name, action]) => ({
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
    await replyWithGif(interaction, action.gif, `${action.emoji} ${text}`);
  },
}));

const emoteCommand = {
  data: new SlashCommandBuilder()
    .setName('emote')
    .setDescription('Show how you feel with a GIF')
    .addStringOption((o) =>
      o
        .setName('mood')
        .setDescription('How are you feeling?')
        .setRequired(true)
        .addChoices(...Object.entries(EMOTES).map(([name, emote]) => ({ name: `${emote.emoji} ${name}`, value: name }))),
    ),

  async execute(interaction) {
    const emote = EMOTES[interaction.options.getString('mood')];
    const text = pick(emote.lines).replaceAll('{a}', `${interaction.user}`);
    await replyWithGif(interaction, emote.gif, `${emote.emoji} ${text}`);
  },
};

module.exports = [...actionCommands, emoteCommand];
