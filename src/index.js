require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DISCORD_TOKEN } = require('./config');
const supabase = require('./supabase');
const { getLatestVersion, getPatchNote } = require('./utils/patchnotes');

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
const cmdFiles = ['help', 'link', 'accounts', 'primary', 'unlink', 'stats', 'inhouse', 'teamtest', 'voicetest', 'lane', 'tiersetting', 'result', 'ranking', 'addplayer', 'removeplayer', 'patchchannel'];
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

client.once('clientReady', async () => {
  console.log(`✅ ${client.user.tag} 온라인`);

  const currentVersion = getLatestVersion();
  const patchNote = getPatchNote(currentVersion);
  if (!patchNote) return;

  for (const guild of client.guilds.cache.values()) {
    try {
      const { data: history } = await supabase
        .from('patch_history')
        .select('last_version')
        .eq('guild_id', guild.id)
        .maybeSingle();

      if (history?.last_version === currentVersion) continue;

      const { data: setting } = await supabase
        .from('bot_settings')
        .select('value')
        .eq('guild_id', guild.id)
        .eq('key', 'patch_channel')
        .maybeSingle();

      if (!setting) continue;

      const channel = await client.channels.fetch(setting.value).catch(() => null);
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`📢 패치노트 v${currentVersion}`)
        .setDescription(`**${patchNote.title}**\n\n${patchNote.changes.map(c => `• ${c}`).join('\n')}`)
        .setFooter({ text: patchNote.date });

      await channel.send({ embeds: [embed] });

      await supabase.from('patch_history').upsert({
        guild_id: guild.id,
        last_version: currentVersion,
        notified_at: new Date().toISOString(),
      }, { onConflict: 'guild_id' });
    } catch (e) { console.error(`패치노트 공지 실패 (${guild.name}):`, e.message); }
  }
});
client.login(DISCORD_TOKEN);
