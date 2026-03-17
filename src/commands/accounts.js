const { EmbedBuilder } = require('discord.js');
const { listAccountsByDiscordId } = require('../utils/accounts');

module.exports = {
  name: '연동목록',
  async execute(message) {
    try {
      const accounts = await listAccountsByDiscordId(message.author.id);
      if (!accounts.length) {
        return message.reply('❌ 등록된 계정이 없습니다. 먼저 `!연동 소환사명#태그`를 사용하세요.');
      }

      const lines = accounts.map((account, index) => {
        const marker = account.is_primary ? '⭐ 대표' : `${index + 1}.`;
        return `${marker} **${account.riot_id}**`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 연동 계정 목록')
        .setDescription(lines.join('\n'));

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply('❌ 연동 계정 목록을 불러오지 못했습니다.');
    }
  },
};
