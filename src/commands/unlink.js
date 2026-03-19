const supabase = require('../supabase');
const {
  getAccountByDiscordAndRiotId,
  parseRiotIdInput,
  promoteOldestAccount,
} = require('../utils/accounts');

module.exports = {
  name: '연동해제',
  async execute(interaction) {
    const parsed = parseRiotIdInput(interaction.options.getString('riot_id'));
    if (!parsed) return interaction.reply('❌ 형식: `소환사명#태그`');

    try {
      const account = await getAccountByDiscordAndRiotId(interaction.user.id, parsed.riotId);
      if (!account) return interaction.reply('❌ 해당 계정은 내 연동 목록에 없습니다.');

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', account.id)
        .eq('discord_id', interaction.user.id);
      if (error) throw error;

      if (account.is_primary) await promoteOldestAccount(interaction.user.id);

      return interaction.reply(`✅ **${account.riot_id}** 연동을 해제했습니다.`);
    } catch (error) {
      console.error(error);
      return interaction.reply('❌ 연동 해제에 실패했습니다.');
    }
  },
};
