const { EmbedBuilder } = require('discord.js');
const analyzer = require('../utils/analyzer');
const matchmaker = require('../utils/matchmaker');
const { getPrimaryAccountByDiscordId } = require('../utils/accounts');

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

function clampScore(score) {
  return Math.max(0.5, +(score.toFixed(2)));
}

function formatMember(player, userMap) {
  const user = userMap.get(player.discordId);
  if (!user) {
    return `**${player.assignedLane}** - ${player.discordId}`;
  }

  if (user.isDummy) {
    return `**${player.assignedLane}** - ${user.riotId}`;
  }

  return `**${player.assignedLane}** - <@${player.discordId}> (${user.riotId})`;
}

module.exports = {
  name: '팀테스트',
  async execute(message) {
    try {
      if (!message.guild) {
        return message.reply('❌ 서버 안에서만 사용할 수 있습니다.');
      }

      const account = await getPrimaryAccountByDiscordId(message.author.id);
      if (!account) {
        return message.reply('❌ 먼저 `!연동`으로 계정을 등록하고 대표 계정을 설정하세요.');
      }

      await message.reply('🧪 테스트 팀을 생성 중입니다...');

      const analysis = await analyzer.analyzePlayer(account.puuid);
      const realPlayer = {
        discordId: message.author.id,
        riotId: account.riot_id,
        score: analysis.score,
        mainLane: analysis.mainLane,
        subLane: 'MID',
        playStyle: analysis.playStyle,
      };

      const dummyPlayers = TEST_PROFILES.map((profile, index) => ({
        discordId: `test-slot-${index + 1}`,
        riotId: profile.riotId,
        score: clampScore(realPlayer.score + profile.scoreDelta),
        mainLane: profile.mainLane,
        subLane: profile.subLane,
        playStyle: profile.playStyle,
      }));

      const players = [realPlayer, ...dummyPlayers];
      const result = matchmaker.findOptimalTeams(players);

      const userMap = new Map([
        [message.author.id, { riotId: account.riot_id, isDummy: false }],
        ...dummyPlayers.map((player) => [player.discordId, { riotId: player.riotId, isDummy: true }]),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🧪 테스트 팀 결과')
        .setDescription('실제 참가자가 부족해 더미 슬롯 9명을 채워 미리보기한 결과입니다.')
        .addFields(
          {
            name: '🔵 블루팀',
            value: result.team1.map((player) => formatMember(player, userMap)).join('\n'),
            inline: true,
          },
          {
            name: '🔴 레드팀',
            value: result.team2.map((player) => formatMember(player, userMap)).join('\n'),
            inline: true,
          },
          {
            name: '참고',
            value: `내 계정: **${account.riot_id}**\n내 점수 기준으로 테스트 슬롯 점수를 비슷하게 생성했습니다.`,
          },
        );

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply('❌ 테스트 팀 생성 중 오류가 발생했습니다.');
    }
  },
};
