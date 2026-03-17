const supabase = require('../supabase');
const {
  getAccountByDiscordAndRiotId,
  getPrimaryAccountByDiscordId,
  parseRiotIdInput,
} = require('../utils/accounts');
const {
  formatTierDisplay,
  parseTierSettingArgs,
} = require('../utils/tier');

async function resolveTargetAccount(discordId, riotIdInput) {
  if (!riotIdInput) {
    return getPrimaryAccountByDiscordId(discordId);
  }

  const parsed = parseRiotIdInput(riotIdInput);
  if (!parsed) {
    return { error: '❌ Riot ID 형식은 `소환사명#태그`여야 합니다.' };
  }

  const account = await getAccountByDiscordAndRiotId(discordId, parsed.riotId);
  if (!account) {
    return { error: '❌ 해당 계정은 내 연동 목록에 없습니다. `!연동목록`으로 확인하세요.' };
  }

  return account;
}

module.exports = {
  name: '티어세팅',
  aliases: ['티어설정'],
  async execute(message, args) {
    try {
      const parsed = parseTierSettingArgs(args);
      if (parsed.error) {
        return message.reply(parsed.error);
      }

      const account = await resolveTargetAccount(message.author.id, parsed.riotIdInput);
      if (account?.error) {
        return message.reply(account.error);
      }
      if (!account) {
        return message.reply('❌ 먼저 `!연동`으로 계정을 등록하고 대표 계정을 설정하세요.');
      }

      if (parsed.reset) {
        const { error } = await supabase
          .from('tier_overrides')
          .delete()
          .eq('puuid', account.puuid);
        if (error) throw error;

        return message.reply(`✅ **${account.riot_id}** 계정의 수동 티어 보정을 해제했습니다.`);
      }

      const { error } = await supabase.from('tier_overrides').upsert({
        puuid: account.puuid,
        tier: parsed.tier,
        rank: parsed.rank,
        lp: parsed.lp,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'puuid' });
      if (error) throw error;

      return message.reply(`✅ **${account.riot_id}** 계정의 수동 티어를 **${formatTierDisplay(parsed, { includeLp: false })}** 로 저장했습니다.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ 티어 설정에 실패했습니다.');
    }
  },
};
