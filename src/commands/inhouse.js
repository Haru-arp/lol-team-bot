const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../supabase');
const analyzer = require('../utils/analyzer');
const matchmaker = require('../utils/matchmaker');
const voice = require('../utils/voice');

// guildId -> { hostId, participants: Map<userId, user>, messageId }
const activeLobbies = new Map();

function lobbyEmbed(lobby) {
  const list = [...lobby.participants.values()].map((u, i) => `${i + 1}. ${u.displayName}`).join('\n') || '없음';
  return new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle('⚔️ 내전 모집')
    .setDescription(`참가자 (${lobby.participants.size}/10)\n${list}`)
    .setFooter({ text: '10명이 모이면 시작할 수 있습니다.' });
}

function lobbyButtons(hostId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('inhouse_join').setLabel('참가').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('inhouse_leave').setLabel('나가기').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('inhouse_start').setLabel('시작').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('inhouse_cancel').setLabel('취소').setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  name: '내전',
  activeLobbies,

  async execute(message) {
    if (activeLobbies.has(message.guild.id)) {
      return message.reply('❌ 이미 진행 중인 내전이 있습니다.');
    }

    const lobby = { hostId: message.author.id, participants: new Map() };
    activeLobbies.set(message.guild.id, lobby);

    const msg = await message.channel.send({
      embeds: [lobbyEmbed(lobby)],
      components: [lobbyButtons(lobby.hostId)],
    });
    lobby.messageId = msg.id;
  },

  async handleButton(interaction) {
    const lobby = activeLobbies.get(interaction.guild.id);
    if (!lobby) return interaction.reply({ content: '❌ 활성 로비가 없습니다.', ephemeral: true });

    const userId = interaction.user.id;

    if (interaction.customId === 'inhouse_join') {
      if (lobby.participants.size >= 10) return interaction.reply({ content: '❌ 이미 10명입니다.', ephemeral: true });
      lobby.participants.set(userId, { id: userId, displayName: interaction.user.displayName });
      await interaction.update({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });

    } else if (interaction.customId === 'inhouse_leave') {
      lobby.participants.delete(userId);
      await interaction.update({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });

    } else if (interaction.customId === 'inhouse_cancel') {
      if (userId !== lobby.hostId) return interaction.reply({ content: '❌ 방장만 취소할 수 있습니다.', ephemeral: true });
      activeLobbies.delete(interaction.guild.id);
      await interaction.update({ content: '❌ 내전이 취소되었습니다.', embeds: [], components: [] });

    } else if (interaction.customId === 'inhouse_start') {
      if (userId !== lobby.hostId) return interaction.reply({ content: '❌ 방장만 시작할 수 있습니다.', ephemeral: true });
      if (lobby.participants.size < 10) return interaction.reply({ content: '❌ 최소 10명이 필요합니다.', ephemeral: true });

      await interaction.deferUpdate();
      await interaction.editReply({ content: '🔍 전적 분석 중... 잠시만 기다려주세요.', embeds: [], components: [] });

      const ids = [...lobby.participants.keys()];
      const { data: users } = await supabase.from('users').select('discord_id, puuid, riot_id').in('discord_id', ids);

      if (!users || users.length < 10) {
        return interaction.editReply({ content: '❌ 모든 참가자가 `!연동`을 완료해야 합니다.' });
      }

      // Fetch lane preferences
      const { data: lanePrefs } = await supabase.from('lane_preferences').select('*').in('discord_id', ids);
      const prefMap = new Map((lanePrefs || []).map(p => [p.discord_id, p]));

      // Analyze all players
      const players = await Promise.all(users.map(async (u) => {
        const analysis = await analyzer.analyzePlayer(u.puuid);
        const pref = prefMap.get(u.discord_id);
        return {
          discordId: u.discord_id,
          riotId: u.riot_id,
          score: analysis.score,
          mainLane: pref?.primary_lane || analysis.mainLane,
          subLane: pref?.secondary_lane || null,
          playStyle: analysis.playStyle,
        };
      }));

      const result = matchmaker.findOptimalTeams(players);

      const formatTeam = (team) => team.map((p) => {
        const user = users.find(u => u.discord_id === p.discordId);
        return `**${p.assignedLane}** - ${user?.riot_id || p.discordId}`;
      }).join('\n');

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('⚔️ 내전 팀 구성 완료')
        .setDescription(`팀 점수 차이: ${result.scoreDiff}`)
        .addFields(
          { name: '🔵 블루팀', value: formatTeam(result.team1) || '없음', inline: true },
          { name: '🔴 레드팀', value: formatTeam(result.team2) || '없음', inline: true },
        );

      await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] });

      // Save match to DB for !결과 command
      const toDbTeam = (team) => team.map(p => ({
        discord_id: p.discordId,
        lane: p.assignedLane,
      }));
      await supabase.from('matches').insert({
        guild_id: interaction.guild.id,
        team1: toDbTeam(result.team1),
        team2: toDbTeam(result.team2),
      });

      activeLobbies.delete(interaction.guild.id);

      // Move to voice channels
      voice.moveTeamsToVoice(interaction.guild, result.team1, result.team2).catch(console.error);
    }
  },
};
