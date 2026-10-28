
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID"
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if Velune bot is online"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show Velune bot commands")
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`Velune is online as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Command registration failed:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong! Velune is online 🌙");
  }

  if (interaction.commandName === "help") {
    await interaction.reply(
      "**Velune Commands**\n/ping — Check bot status\n/help — Show commands"
    );
  }
});

client.login(token).catch(error => {
  console.error("Bot login failed:", error);
});
