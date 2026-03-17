const { PermissionsBitField } = require('discord.js');
const riot = require('../riot');
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

async function resolveTargetAccount(message, riotIdInput) {
  if (!riotIdInput) {
    const account = await getPrimaryAccountByDiscordId(message.author.id);
    return account ? { account, isOwnAccount: true } : null;
  }

  const parsed = parseRiotIdInput(riotIdInput);
  if (!parsed) {
    return { error: '❌ Riot ID 형식은 `소환사명#태그`여야 합니다.' };
  }

  const ownAccount = await getAccountByDiscordAndRiotId(message.author.id, parsed.riotId);
  if (ownAccount) {
    return { account: ownAccount, isOwnAccount: true };
  }

  if (!message.guild || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return { error: '❌ 다른 사람 계정의 티어를 바꾸려면 서버 관리 권한이 필요합니다.' };
  }

  const riotAccount = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
  if (!riotAccount) {
    return { error: '❌ 해당 Riot 계정을 찾을 수 없습니다.' };
  }

  return {
    account: {
      puuid: riotAccount.puuid,
      riot_id: `${riotAccount.gameName || parsed.gameName}#${riotAccount.tagLine || parsed.tagLine}`,
    },
    isOwnAccount: false,
  };
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

      const target = await resolveTargetAccount(message, parsed.riotIdInput);
      if (target?.error) {
        return message.reply(target.error);
      }
      if (!target?.account) {
        return message.reply('❌ 먼저 `!연동`으로 계정을 등록하고 대표 계정을 설정하세요.');
      }
      const { account } = target;

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
