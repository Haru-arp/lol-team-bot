const { EmbedBuilder } = require('discord.js');
const riot = require('../riot');
const analyzer = require('../utils/analyzer');
const {
  getPrimaryAccountByDiscordId,
  parseRiotIdInput,
} = require('../utils/accounts');
const { formatTierDisplay, getTierOverrideByPuuid } = require('../utils/tier');

const STYLE_EMOJI = { carry: '🗡️ 캐리형', tank: '🛡️ 탱커형', support: '🤝 팀플형' };

module.exports = {
  name: '전적',
  async execute(message, args) {
    let puuid;
    let riotId;
    let tierOverride;

    if (args.length) {
      const parsed = parseRiotIdInput(args.join(' '));
      if (!parsed) return message.reply('❌ 형식: `!전적 소환사명#태그`');

      const account = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
      if (!account) return message.reply('❌ 해당 Riot 계정을 찾을 수 없습니다.');

      puuid = account.puuid;
      riotId = `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`;
      tierOverride = await getTierOverrideByPuuid(puuid);
    } else {
      const account = await getPrimaryAccountByDiscordId(message.author.id);
      if (!account) return message.reply('❌ 먼저 `!연동`으로 계정을 등록하고 `!대표` 계정을 설정하세요.');
      puuid = account.puuid;
      riotId = account.riot_id;
      tierOverride = await getTierOverrideByPuuid(puuid);
    }

    try {
      await message.reply('🔍 전적 조회 중...');
      const stats = await analyzer.analyzePlayer(puuid, {
        tierOverride,
        includeSeasonTopChampions: true,
      });
      const laneStr = Object.entries(stats.laneStats).sort((a, b) => b[1] - a[1]).map(([l, p]) => `${l} ${p}%`).join(', ');
      const topChampions = stats.topChampions.length
        ? stats.topChampions.map((champion, index) => `${index + 1}. ${champion.name} (숙련도 ${champion.points.toLocaleString()}점)`).join('\n')
        : '없음';
      const seasonTopChampions = stats.seasonTopChampions.length
        ? stats.seasonTopChampions.map((champion, index) => `${index + 1}. ${champion.name} (${champion.count}판)`).join('\n')
        : '없음';
      const tierLabel = formatTierDisplay(stats, { includeLp: stats.tierSource !== 'manual' });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${riotId}`)
        .addFields(
          { name: '🏅 티어', value: stats.tierSource === 'manual' ? `${tierLabel} (수동 보정)` : tierLabel, inline: true },
          { name: '🗺️ 주 라인', value: stats.mainLane, inline: true },
          { name: '📈 승률', value: `${stats.winRate}%`, inline: true },
          { name: '⚔️ 평균 KDA', value: `${stats.avgKDA}`, inline: true },
          { name: '🗺️ 라인 분포', value: laneStr || '없음' },
          { name: '🏆 전체 모스트', value: topChampions, inline: true },
          { name: '📅 이번 시즌 모스트', value: seasonTopChampions, inline: true },
          { name: '🎯 플레이 스타일', value: STYLE_EMOJI[stats.playStyle] || stats.playStyle },
          { name: '📊 종합 점수', value: `${stats.score}`, inline: true },
        );

      message.channel.send({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      message.reply('❌ 전적 조회에 실패했습니다.');
    }
  },
};
