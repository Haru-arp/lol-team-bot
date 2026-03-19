const {
  getAccountByDiscordAndRiotId,
  parseRiotIdInput,
  setPrimaryAccount,
} = require('../utils/accounts');

module.exports = {
  name: '대표',
  async execute(interaction) {
    const parsed = parseRiotIdInput(interaction.options.getString('riot_id'));
    if (!parsed) return interaction.reply('❌ 형식: `소환사명#태그`');

    try {
      const account = await getAccountByDiscordAndRiotId(interaction.user.id, parsed.riotId);
      if (!account) return interaction.reply('❌ 해당 계정은 내 연동 목록에 없습니다. `/연동목록`으로 확인하세요.');

      await setPrimaryAccount(interaction.user.id, account.id);
      return interaction.reply(`✅ 대표 계정을 **${account.riot_id}** 로 변경했습니다.`);
    } catch (error) {
      console.error(error);
      return interaction.reply('❌ 대표 계정 변경에 실패했습니다.');
    }
  },
};
