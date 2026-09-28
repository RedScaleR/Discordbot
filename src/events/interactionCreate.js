const { Events, MessageFlags, RESTJSONErrorCodes } = require('discord.js');
const { oops } = require('../util/cute');

async function reportError(interaction, label, err) {
  console.error(`[${label}]`, err);
  const message =
    err.code === RESTJSONErrorCodes.MissingPermissions
      ? "I don't have permission to do that! Check my role's permissions in Server Settings"
      : 'Something went wrong while doing that';
  const payload = { embeds: [oops(message)], flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
  else await interaction.reply(payload).catch(() => {});
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        await reportError(interaction, `/${interaction.commandName}`, err);
      }
      return;
    }

    // Long-lived buttons (like role panels) are routed by the start of their custom ID.
    // Short-lived ones (like /rps) are handled by collectors inside their own command.
    if (interaction.isButton()) {
      const prefix = interaction.customId.split(':')[0];
      const command = interaction.client.commands.find((c) => c.buttonPrefix === prefix);
      if (!command) return;
      try {
        await command.handleButton(interaction);
      } catch (err) {
        await reportError(interaction, `button ${prefix}`, err);
      }
    }
  },
};
