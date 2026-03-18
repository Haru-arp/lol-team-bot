const { EmbedBuilder } = require('discord.js');
const riot = require('../riot');
const supabase = require('../supabase');
const analyzer = require('../utils/analyzer');
const {
  getAccountByPuuid,
  listAccountsByDiscordId,
  parseRiotIdInput,
} = require('../utils/accounts');

module.exports = {
  name: '연동',
  async execute(message, args) {
    const parsed = parseRiotIdInput(args.join(' '));
    if (!parsed) {
      return message.reply('❌ 형식: `!연동 소환사명#태그`');
    }

    try {
      const { gameName, tagLine } = parsed;
      const account = await riot.getAccountByRiotId(gameName, tagLine);
      if (!account) {
        return message.reply('❌ 계정을 찾을 수 없습니다.');
      }

      const summoner = await riot.getSummonerByPuuid(account.puuid);
      const riotId = `${account.gameName || gameName}#${account.tagLine || tagLine}`;
      const existing = await getAccountByPuuid(account.puuid);

      if (existing && existing.discord_id !== message.author.id) {
        return message.reply('❌ 이미 다른 디스코드 계정에 연동된 Riot 계정입니다.');
      }

      if (existing && existing.discord_id === message.author.id) {
        const { error } = await supabase
          .from('users')
          .update({
            riot_id: riotId,
            summoner_name: summoner?.name || account.gameName || gameName,
          })
          .eq('id', existing.id)
          .eq('discord_id', message.author.id);
        if (error) throw error;

        return message.reply(`✅ 이미 연동된 계정입니다. Riot ID를 **${riotId}** 로 갱신했습니다.`);
      }

      const accounts = await listAccountsByDiscordId(message.author.id);

      const { error } = await supabase.from('users').insert({
        discord_id: message.author.id,
        riot_id: riotId,
        puuid: account.puuid,
        summoner_name: summoner?.name || account.gameName || gameName,
        is_primary: accounts.length === 0,
      });
      if (error) throw error;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ 계정 연동 완료')
        .setDescription(`**${riotId}** 계정이 연동되었습니다.${accounts.length === 0 ? '\n이 계정이 대표 계정으로 설정되었습니다.' : ''}`);

      // 첫 연동 시 라인 선호도 자동 설정
      if (accounts.length === 0) {
        const { data: existingPref } = await supabase
          .from('lane_preferences')
          .select('discord_id')
          .eq('discord_id', message.author.id)
          .maybeSingle();

        if (!existingPref) {
          try {
            const stats = await analyzer.analyzePlayer(account.puuid);
            const sorted = Object.entries(stats.laneStats).sort((a, b) => b[1] - a[1]);
            if (sorted.length >= 2) {
              await supabase.from('lane_preferences').upsert({
                discord_id: message.author.id,
                primary_lane: sorted[0][0],
                secondary_lane: sorted[1][0],
              }, { onConflict: 'discord_id' });
              embed.setDescription(embed.data.description + `\n🗺️ 선호 라인이 **${sorted[0][0]}** / **${sorted[1][0]}** 으로 자동 설정되었습니다.`);
            }
          } catch (_) { /* 라인 자동 설정 실패해도 연동은 유지 */ }
        }
      }

      return message.reply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      return message.reply('❌ 계정 연동에 실패했습니다.');
    }
  },
};
