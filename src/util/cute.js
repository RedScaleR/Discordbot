const { EmbedBuilder, escapeMarkdown } = require('discord.js');

const COLORS = {
  pink: 0xffb7d5,
  mint: 0xa8e6cf,
  lavender: 0xc3b1e1,
  peach: 0xffd3b6,
  sky: 0xa0d8ef,
  red: 0xff8b94,
};

// Asterisks are escaped so Discord doesn't turn them into italics.
const KAOMOJI = {
  happy: ['(◕‿◕)', '(｡•ᴗ•｡)', ':3', '(✿◠‿◠)', '(ﾉ◕ヮ◕)ﾉ\\*:･ﾟ✧', '(˶ᵔ ᵕ ᵔ˶)', ':>', '\\*.\\*', '(≧◡≦)', 'ᕙ(＾▿＾)ᕗ'],
  sad: ['(｡•́︿•̀｡)', '>\\_<', '(╥﹏╥)', ':<', '(っ˘̩╭╮˘̩)っ', '(´；ω；`)'],
  angry: ['(｀へ´)', '(╬ Ò﹏Ó)', '>:(', '(ง •̀\\_•́)ง', '(¬\\_¬)'],
  love: ['(っ◔◡◔)っ ♥', '(´｡• ᵕ •｡`) ♡', '(≧◡≦) ♡', '(´∀｀)♡', '♡(ˊ͈ ꒳ ˋ͈)'],
  shock: ['(°ロ°)', '(⊙\\_⊙)', 'Σ(°△°|||)', ':V', '(ﾟДﾟ;)'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const kao = (mood = 'happy') => pick(KAOMOJI[mood] ?? KAOMOJI.happy);
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Returns a shuffled copy of an array. */
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cuteEmbed({ title, description, color = 'pink', fields, thumbnail, footer } = {}) {
  const embed = new EmbedBuilder().setColor(COLORS[color] ?? color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields?.length) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

const success = (description) => cuteEmbed({ description: `${description} ${kao('happy')}`, color: 'mint' });
const oops = (description) => cuteEmbed({ description: `${description} ${kao('sad')}`, color: 'red' });

function truncate(text, max = 1024) {
  if (!text) return '\u200b';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A user's or member's display name in bold, safe from markdown. */
const bold = (who) => `**${escapeMarkdown(who.displayName ?? who.username)}**`;

module.exports = { COLORS, kao, pick, randomInt, shuffle, cuteEmbed, success, oops, truncate, bold };
