const { EmbedBuilder } = require('discord.js');
const riot = require('../riot');
const supabase = require('../supabase');
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

      return message.reply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      return message.reply('❌ 계정 연동에 실패했습니다.');
    }
  },
};
