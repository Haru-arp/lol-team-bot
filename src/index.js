require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { DISCORD_TOKEN } = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const commands = new Map();
const cmdFiles = ['help', 'link', 'accounts', 'primary', 'unlink', 'stats', 'inhouse', 'teamtest', 'voicetest', 'lane', 'tiersetting', 'result', 'ranking'];
for (const file of cmdFiles) {
  const cmd = require(`./commands/${file}`);
  commands.set(cmd.name, cmd);
  for (const alias of cmd.aliases || []) {
    commands.set(alias, cmd);
  }
}

const PREFIX = '!';

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const [cmdName, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = commands.get(cmdName);
  if (cmd) {
    try { await cmd.execute(message, args); }
    catch (e) { console.error(e); message.reply('❌ 오류가 발생했습니다.'); }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('inhouse_')) {
    const inhouse = commands.get('내전');
    try { await inhouse.handleButton(interaction); }
    catch (e) { console.error(e); }
  }
});

client.once('ready', () => console.log(`✅ ${client.user.tag} 온라인`));
client.login(DISCORD_TOKEN);
