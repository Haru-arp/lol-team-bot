const { PermissionsBitField } = require('discord.js');
const riot = require('../riot');
const supabase = require('../supabase');
const {
  getAccountByDiscordAndRiotId,
  getPrimaryAccountByDiscordId,
  parseRiotIdInput,
} = require('../utils/accounts');
const { formatTierDisplay, parseTierSettingArgs } = require('../utils/tier');

async function resolveTargetAccount(interaction, riotIdInput) {
  if (!riotIdInput) {
    const account = await getPrimaryAccountByDiscordId(interaction.user.id);
    return account ? { account, isOwnAccount: true } : null;
  }

  const parsed = parseRiotIdInput(riotIdInput);
  if (!parsed) return { error: '❌ Riot ID 형식은 `소환사명#태그`여야 합니다.' };

  const ownAccount = await getAccountByDiscordAndRiotId(interaction.user.id, parsed.riotId);
  if (ownAccount) return { account: ownAccount, isOwnAccount: true };

  if (!interaction.guild || !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return { error: '❌ 다른 사람 계정의 티어를 바꾸려면 서버 관리 권한이 필요합니다.' };
  }

  const riotAccount = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
  if (!riotAccount) return { error: '❌ 해당 Riot 계정을 찾을 수 없습니다.' };

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
  async execute(interaction) {
    try {
      const settingValue = interaction.options.getString('설정값');
      const riotIdInput = interaction.options.getString('riot_id');

      const tierArgs = riotIdInput ? [riotIdInput, settingValue] : [settingValue];
      const parsed = parseTierSettingArgs(tierArgs);
      if (parsed.error) return interaction.reply(parsed.error);

      await interaction.deferReply();

      const target = await resolveTargetAccount(interaction, parsed.riotIdInput || riotIdInput);
      if (target?.error) return interaction.editReply(target.error);
      if (!target?.account) return interaction.editReply('❌ 먼저 `/연동`으로 계정을 등록하세요.');
      const { account } = target;

      if (parsed.reset) {
        const { error } = await supabase.from('tier_overrides').delete().eq('puuid', account.puuid);
        if (error) throw error;
        return interaction.editReply(`✅ **${account.riot_id}** 계정의 수동 티어 보정을 해제했습니다.`);
      }

      const { error } = await supabase.from('tier_overrides').upsert({
        puuid: account.puuid,
        tier: parsed.tier,
        rank: parsed.rank,
        lp: parsed.lp,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'puuid' });
      if (error) throw error;

      return interaction.editReply(`✅ **${account.riot_id}** 계정의 수동 티어를 **${formatTierDisplay(parsed, { includeLp: false })}** 로 저장했습니다.`);
    } catch (error) {
      console.error(error);
      return interaction.editReply('❌ 티어 설정에 실패했습니다.');
    }
  },
};
