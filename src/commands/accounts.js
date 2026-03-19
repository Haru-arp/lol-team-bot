const { EmbedBuilder } = require('discord.js');
const { listAccountsByDiscordId } = require('../utils/accounts');

module.exports = {
  name: '연동목록',
  async execute(interaction) {
    try {
      const accounts = await listAccountsByDiscordId(interaction.user.id);
      if (!accounts.length) return interaction.reply('❌ 등록된 계정이 없습니다. `/연동`으로 등록하세요.');

      const lines = accounts.map((account, index) => {
        const marker = account.is_primary ? '⭐ 대표' : `${index + 1}.`;
        return `${marker} **${account.riot_id}**`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 연동 계정 목록')
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply('❌ 연동 계정 목록을 불러오지 못했습니다.');
    }
  },
};
