const { EmbedBuilder } = require('discord.js');
const riot = require('../riot');
const supabase = require('../supabase');

module.exports = {
  name: '연동',
  async execute(message, args) {
    const input = args.join(' ');
    const [gameName, tagLine] = input.split('#');
    if (!gameName || !tagLine) {
      return message.reply('❌ 형식: `!연동 소환사명#태그`');
    }

    try {
      const account = await riot.getAccountByRiotId(gameName, tagLine);
      const summoner = await riot.getSummonerByPuuid(account.puuid);

      await supabase.from('users').upsert({
        discord_id: message.author.id,
        riot_id: `${gameName}#${tagLine}`,
        puuid: account.puuid,
        summoner_name: summoner.name || gameName,
      }, { onConflict: 'discord_id' });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ 계정 연동 완료')
        .setDescription(`**${gameName}#${tagLine}** 계정이 연동되었습니다.`);

      message.reply({ embeds: [embed] });
    } catch (e) {
      message.reply('❌ 계정을 찾을 수 없습니다.');
    }
  },
};
