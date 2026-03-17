const {
  getAccountByDiscordAndRiotId,
  parseRiotIdInput,
  setPrimaryAccount,
} = require('../utils/accounts');

module.exports = {
  name: '대표',
  async execute(message, args) {
    const parsed = parseRiotIdInput(args.join(' '));
    if (!parsed) {
      return message.reply('❌ 형식: `!대표 소환사명#태그`');
    }

    try {
      const account = await getAccountByDiscordAndRiotId(message.author.id, parsed.riotId);
      if (!account) {
        return message.reply('❌ 해당 계정은 내 연동 목록에 없습니다. `!연동목록`으로 확인하세요.');
      }

      await setPrimaryAccount(message.author.id, account.id);
      return message.reply(`✅ 대표 계정을 **${account.riot_id}** 로 변경했습니다.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ 대표 계정 변경에 실패했습니다.');
    }
  },
};
