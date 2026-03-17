const supabase = require('../supabase');
const {
  getAccountByDiscordAndRiotId,
  parseRiotIdInput,
  promoteOldestAccount,
} = require('../utils/accounts');

module.exports = {
  name: '연동해제',
  async execute(message, args) {
    const parsed = parseRiotIdInput(args.join(' '));
    if (!parsed) {
      return message.reply('❌ 형식: `!연동해제 소환사명#태그`');
    }

    try {
      const account = await getAccountByDiscordAndRiotId(message.author.id, parsed.riotId);
      if (!account) {
        return message.reply('❌ 해당 계정은 내 연동 목록에 없습니다.');
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', account.id)
        .eq('discord_id', message.author.id);
      if (error) throw error;

      if (account.is_primary) {
        await promoteOldestAccount(message.author.id);
      }

      return message.reply(`✅ **${account.riot_id}** 연동을 해제했습니다.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ 연동 해제에 실패했습니다.');
    }
  },
};
