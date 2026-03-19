const { EmbedBuilder } = require('discord.js');
const analyzer = require('../utils/analyzer');
const matchmaker = require('../utils/matchmaker');
const { getPrimaryAccountByDiscordId } = require('../utils/accounts');
const { getTierOverrideByPuuid } = require('../utils/tier');
const LANE_DISPLAY_ORDER = { TOP: 0, JG: 1, MID: 2, ADC: 3, SUP: 4 };

const TEST_PROFILES = [
  { riotId: 'TestTop#001', mainLane: 'TOP', subLane: 'MID', playStyle: 'tank', scoreDelta: -0.18 },
  { riotId: 'TestJg#002', mainLane: 'JG', subLane: 'SUP', playStyle: 'carry', scoreDelta: -0.11 },
  { riotId: 'TestMid#003', mainLane: 'MID', subLane: 'TOP', playStyle: 'carry', scoreDelta: -0.05 },
  { riotId: 'TestAdc#004', mainLane: 'ADC', subLane: 'MID', playStyle: 'carry', scoreDelta: 0.02 },
  { riotId: 'TestSup#005', mainLane: 'SUP', subLane: 'ADC', playStyle: 'support', scoreDelta: 0.08 },
  { riotId: 'TestTop#006', mainLane: 'TOP', subLane: 'JG', playStyle: 'tank', scoreDelta: 0.14 },
  { riotId: 'TestJg#007', mainLane: 'JG', subLane: 'MID', playStyle: 'support', scoreDelta: -0.09 },
  { riotId: 'TestMid#008', mainLane: 'MID', subLane: 'ADC', playStyle: 'carry', scoreDelta: 0.06 },
  { riotId: 'TestAdc#009', mainLane: 'ADC', subLane: 'SUP', playStyle: 'carry', scoreDelta: -0.03 },
];

function clampScore(score) { return Math.max(0.5, +(score.toFixed(2))); }

function formatMember(player, userMap) {
  const user = userMap.get(player.discordId);
  if (!user) return `**${player.assignedLane}** - ${player.discordId}`;
  if (user.isDummy) return `**${player.assignedLane}** - ${user.riotId}`;
  return `**${player.assignedLane}** - <@${player.discordId}> (${user.riotId})`;
}

function sortPlayersByLane(team) {
  return [...team].sort((a, b) => (LANE_DISPLAY_ORDER[a.assignedLane] ?? 999) - (LANE_DISPLAY_ORDER[b.assignedLane] ?? 999));
}

module.exports = {
  name: '팀테스트',
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply('❌ 서버 안에서만 사용할 수 있습니다.');

    const account = await getPrimaryAccountByDiscordId(interaction.user.id);
    if (!account) return interaction.reply('❌ 먼저 `/연동`으로 계정을 등록하세요.');

    await interaction.reply('🧪 테스트 팀을 생성 중입니다...');

    try {
      const tierOverride = await getTierOverrideByPuuid(account.puuid);
      const analysis = await analyzer.analyzePlayer(account.puuid, { tierOverride });
      const realPlayer = {
        discordId: interaction.user.id, riotId: account.riot_id,
        score: analysis.score, mainLane: analysis.mainLane, subLane: 'MID', playStyle: analysis.playStyle,
      };

      const dummyPlayers = TEST_PROFILES.map((p, i) => ({
        discordId: `test-slot-${i + 1}`, riotId: p.riotId,
        score: clampScore(realPlayer.score + p.scoreDelta),
        mainLane: p.mainLane, subLane: p.subLane, playStyle: p.playStyle,
      }));

      const result = matchmaker.findOptimalTeams([realPlayer, ...dummyPlayers]);
      const userMap = new Map([
        [interaction.user.id, { riotId: account.riot_id, isDummy: false }],
        ...dummyPlayers.map(p => [p.discordId, { riotId: p.riotId, isDummy: true }]),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🧪 테스트 팀 결과')
        .setDescription('더미 슬롯 9명을 채워 미리보기한 결과입니다.')
        .addFields(
          { name: '🔵 블루팀', value: sortPlayersByLane(result.team1).map(p => formatMember(p, userMap)).join('\n'), inline: true },
          { name: '🔴 레드팀', value: sortPlayersByLane(result.team2).map(p => formatMember(p, userMap)).join('\n'), inline: true },
        );

      interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      console.error(error);
      interaction.editReply('❌ 테스트 팀 생성 중 오류가 발생했습니다.');
    }
  },
};
