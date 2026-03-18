const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const supabase = require('../supabase');
const analyzer = require('../utils/analyzer');
const matchmaker = require('../utils/matchmaker');
const voice = require('../utils/voice');
const { listTierOverridesByPuuids } = require('../utils/tier');

// guildId -> { hostId, participants: Map<userId, user>, messageId }
const activeLobbies = new Map();
const INHOUSE_RECENT_MATCH_COUNT = 8;
const pendingVoiceMoves = new Map();

function formatTeamMember(player, userMap) {
  const riotId = userMap.get(player.discordId)?.riot_id || player.discordId;
  if (player.discordId.startsWith('ext_')) return `**${player.assignedLane}** - ${riotId}`;
  return `**${player.assignedLane}** - <@${player.discordId}> (${riotId})`;
}

function buildVoiceReadyMessage(blueVC, redVC) {
  return [
    `🔊 음성 채널을 준비했습니다. 합의가 끝나면 버튼을 눌러 ${blueVC} / ${redVC} 로 이동하세요.`,
    '팀 교체가 필요하면 먼저 조정한 뒤 이동 버튼을 누르세요.',
    '이동 대상은 현재 팀 결과 기준이며, 음성 채널에 접속 중인 인원만 이동됩니다.',
  ].join('\n');
}

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

function moveButtonRow(moveToken) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inhouse_move_${moveToken}`)
      .setLabel('이동하기')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildBanRecommendations(team, opponent, playerMap) {
  const championScores = new Map();

  const addCandidate = (championName, points, reason) => {
    if (!championName || points <= 0) return;
    const current = championScores.get(championName) || { score: 0, reasons: [] };
    current.score += points;
    if (reason && current.reasons.length < 3 && !current.reasons.includes(reason)) {
      current.reasons.push(reason);
    }
    championScores.set(championName, current);
  };

  opponent.forEach((player) => {
    const detail = playerMap.get(player.discordId);
    if (!detail) return;

    detail.recentTopChampions.forEach((champion, index) => {
      const base = [7, 5, 3][index] || 2;
      const volume = Math.min(champion.count, 8) * 0.8;
      addCandidate(champion.name, base + volume, `${detail.riotId} 최근 ${champion.count}판`);
    });

    detail.topChampions.forEach((champion, index) => {
      const base = [5, 3.5, 2][index] || 1;
      const masteryWeight = Math.min(Math.log10((champion.points || 1) + 1), 6);
      addCandidate(champion.name, base + masteryWeight, `${detail.riotId} 숙련도 ${champion.points.toLocaleString()}점`);
    });

    if (detail.playStyle === 'carry') {
      const primaryRecent = detail.recentTopChampions[0]?.name;
      if (primaryRecent) {
        addCandidate(primaryRecent, 2, `${detail.riotId} 캐리 성향`);
      }
    }
  });

  const teamChampionPool = new Set(team.flatMap((player) => {
    const detail = playerMap.get(player.discordId);
    return detail?.recentTopChampions.map((champion) => champion.name) || [];
  }));

  return [...championScores.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .filter(([championName]) => !teamChampionPool.has(championName))
    .slice(0, 5)
    .map(([championName, info], index) => `${index + 1}. ${championName} (${info.reasons.join(', ')})`)
    .join('\n') || '추천 데이터 없음';
}

module.exports = {
  name: '내전',
  activeLobbies,
  pendingVoiceMoves,
  lobbyEmbed,
  lobbyButtons,

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
    if (interaction.customId.startsWith('inhouse_move_')) {
      const pendingMove = pendingVoiceMoves.get(interaction.guild.id);
      if (!pendingMove) {
        return interaction.reply({ content: '❌ 이동할 팀 정보가 없습니다.', flags: MessageFlags.Ephemeral });
      }

      const moveToken = interaction.customId.slice('inhouse_move_'.length);
      if (pendingMove.token !== moveToken) {
        return interaction.reply({ content: '❌ 이 이동 버튼은 더 이상 유효하지 않습니다.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.user.id !== pendingMove.hostId) {
        return interaction.reply({ content: '❌ 방장만 팀 이동을 실행할 수 있습니다.', flags: MessageFlags.Ephemeral });
      }

      const moveResult = await voice.moveTeamsToVoice(
        interaction.guild,
        pendingMove.team1,
        pendingMove.team2,
        pendingMove.channels,
      );

      pendingVoiceMoves.delete(interaction.guild.id);
      await interaction.update({
        content: `✅ 팀 이동을 시도했습니다. 현재 음성 채널에 접속해 있던 **${moveResult.movedCount}명**을 ${pendingMove.channels.blueVC} / ${pendingMove.channels.redVC} 로 이동했습니다.`,
        components: [],
      });
      return;
    }

    const lobby = activeLobbies.get(interaction.guild.id);
    if (!lobby) return interaction.reply({ content: '❌ 활성 로비가 없습니다.', flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;

    if (interaction.customId === 'inhouse_join') {
      if (lobby.participants.size >= 10) return interaction.reply({ content: '❌ 이미 10명입니다.', flags: MessageFlags.Ephemeral });
      lobby.participants.set(userId, { id: userId, displayName: interaction.user.displayName });
      await interaction.update({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });

    } else if (interaction.customId === 'inhouse_leave') {
      lobby.participants.delete(userId);
      await interaction.update({ embeds: [lobbyEmbed(lobby)], components: [lobbyButtons(lobby.hostId)] });

    } else if (interaction.customId === 'inhouse_cancel') {
      if (userId !== lobby.hostId) return interaction.reply({ content: '❌ 방장만 취소할 수 있습니다.', flags: MessageFlags.Ephemeral });
      activeLobbies.delete(interaction.guild.id);
      await interaction.update({ content: '❌ 내전이 취소되었습니다.', embeds: [], components: [] });

    } else if (interaction.customId === 'inhouse_start') {
      if (userId !== lobby.hostId) return interaction.reply({ content: '❌ 방장만 시작할 수 있습니다.', flags: MessageFlags.Ephemeral });
      if (lobby.participants.size < 10) return interaction.reply({ content: '❌ 최소 10명이 필요합니다.', flags: MessageFlags.Ephemeral });

      await interaction.deferUpdate();
      await interaction.editReply({ content: '🔍 전적 분석 중... 잠시만 기다려주세요.', embeds: [], components: [] });

      // 외부 참가자와 연동 참가자 분리
      const externalParticipants = [];
      const linkedIds = [];
      for (const [key, p] of lobby.participants) {
        if (p.isExternal) externalParticipants.push(p);
        else linkedIds.push(key);
      }

      const { data: users } = await supabase
        .from('users')
        .select('discord_id, puuid, riot_id')
        .in('discord_id', linkedIds)
        .eq('is_primary', true);

      const linkedCount = (users || []).length;
      if (linkedCount + externalParticipants.length < 10) {
        return interaction.editReply({ content: '❌ 연동되지 않은 참가자가 있습니다. `!연동`을 완료하거나 `!참가인원추가`로 추가하세요.' });
      }

      // 모든 참가자의 puuid 목록 (연동 + 외부)
      const allUsers = [
        ...(users || []),
        ...externalParticipants.map(p => ({ discord_id: p.id, puuid: p.puuid, riot_id: p.riotId })),
      ];

      // Fetch lane preferences (외부 참가자는 DB에 없으므로 연동 유저만)
      const { data: lanePrefs } = await supabase.from('lane_preferences').select('*').in('discord_id', linkedIds);
      const prefMap = new Map((lanePrefs || []).map(p => [p.discord_id, p]));
      const tierOverrides = await listTierOverridesByPuuids(allUsers.map((user) => user.puuid));
      const tierOverrideMap = new Map(tierOverrides.map((override) => [override.puuid, override]));

      // Analyze all players
      let completedAnalyses = 0;
      let lastProgressUpdate = 0;
      const players = await Promise.all(allUsers.map(async (u) => {
        const analysis = await analyzer.analyzePlayer(u.puuid, {
          tierOverride: tierOverrideMap.get(u.puuid),
          recentMatchCount: INHOUSE_RECENT_MATCH_COUNT,
        });

        completedAnalyses += 1;
        if (completedAnalyses === allUsers.length || completedAnalyses - lastProgressUpdate >= 2) {
          lastProgressUpdate = completedAnalyses;
          await interaction.editReply({
            content: `🔍 전적 분석 중... (${completedAnalyses}/${allUsers.length})`,
            embeds: [],
            components: [],
          });
        }

        const pref = prefMap.get(u.discord_id);
        const sortedLanes = Object.entries(analysis.laneStats).sort((a, b) => b[1] - a[1]);
        return {
          discordId: u.discord_id,
          riotId: u.riot_id,
          score: analysis.score,
          mainLane: pref?.primary_lane || sortedLanes[0]?.[0] || analysis.mainLane,
          subLane: pref?.secondary_lane || sortedLanes[1]?.[0] || null,
          playStyle: analysis.playStyle,
          recentTopChampions: analysis.recentTopChampions,
          topChampions: analysis.topChampions,
        };
      }));

      const result = matchmaker.findOptimalTeams(players);
      const userMap = new Map(allUsers.map((user) => [user.discord_id, { ...user, riot_id: user.riot_id }]));
      const playerMap = new Map(players.map((player) => [player.discordId, player]));

      const formatTeam = (team) => team.map((player) => formatTeamMember(player, userMap)).join('\n');
      const blueBanRecommendations = buildBanRecommendations(result.team1, result.team2, playerMap);
      const redBanRecommendations = buildBanRecommendations(result.team2, result.team1, playerMap);

      const resultEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('⚔️ 내전 팀 구성 완료')
        .setDescription(`팀 점수 차이: ${result.scoreDiff}`)
        .addFields(
          { name: '🔵 블루팀', value: formatTeam(result.team1) || '없음', inline: true },
          { name: '🔴 레드팀', value: formatTeam(result.team2) || '없음', inline: true },
          { name: '🔵 블루팀 추천 밴', value: blueBanRecommendations, inline: false },
          { name: '🔴 레드팀 추천 밴', value: redBanRecommendations, inline: false },
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

      const channels = await voice.prepareTeamVoiceChannels(interaction.guild);
      const moveToken = `${Date.now()}`;
      pendingVoiceMoves.set(interaction.guild.id, {
        token: moveToken,
        hostId: lobby.hostId,
        team1: result.team1,
        team2: result.team2,
        channels,
      });

      await interaction.followUp({
        content: buildVoiceReadyMessage(channels.blueVC, channels.redVC),
        components: [moveButtonRow(moveToken)],
      });
    }
  },
};
