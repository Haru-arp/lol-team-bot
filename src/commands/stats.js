const { EmbedBuilder } = require('discord.js');
const supabase = require('../supabase');
const analyzer = require('../utils/analyzer');

const STYLE_EMOJI = { carry: '🗡️ 캐리형', tank: '🛡️ 탱커형', support: '🤝 팀플형' };

module.exports = {
  name: '전적',
  async execute(message, args) {
    let puuid, riotId;

    if (args.length) {
      const [gameName, tagLine] = args.join(' ').split('#');
      if (!tagLine) return message.reply('❌ 형식: `!전적 소환사명#태그`');
      const { data } = await supabase.from('users').select('puuid, riot_id').eq('riot_id', `${gameName}#${tagLine}`).single();
      if (!data) return message.reply('❌ 등록되지 않은 소환사입니다. 먼저 `!연동`을 해주세요.');
      puuid = data.puuid;
      riotId = data.riot_id;
    } else {
      const { data } = await supabase.from('users').select('puuid, riot_id').eq('discord_id', message.author.id).single();
      if (!data) return message.reply('❌ 먼저 `!연동`으로 계정을 등록하세요.');
      puuid = data.puuid;
      riotId = data.riot_id;
    }

    try {
      await message.reply('🔍 전적 조회 중...');
      const stats = await analyzer.analyzePlayer(puuid);
      const laneStr = Object.entries(stats.laneStats).sort((a, b) => b[1] - a[1]).map(([l, p]) => `${l} ${p}%`).join(', ');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${riotId}`)
        .addFields(
          { name: '🏅 티어', value: `${stats.tier} ${stats.rank} (${stats.lp}LP)`, inline: true },
          { name: '🗺️ 주 라인', value: stats.mainLane, inline: true },
          { name: '📈 승률', value: `${stats.winRate}%`, inline: true },
          { name: '⚔️ 평균 KDA', value: `${stats.avgKDA}`, inline: true },
          { name: '🗺️ 라인 분포', value: laneStr || '없음' },
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
