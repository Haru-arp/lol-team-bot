const voice = require('../utils/voice');

const TEST_DELAY_SECONDS = 5;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  name: '음성테스트',
  async execute(interaction) {
    if (!interaction.guild) return interaction.reply('❌ 서버 안에서만 사용할 수 있습니다.');
    if (!interaction.member.voice.channel) return interaction.reply('❌ 먼저 아무 음성 채널에 접속한 뒤 다시 시도하세요.');

    const channels = await voice.prepareTeamVoiceChannels(interaction.guild);
    await interaction.reply(`🧪 음성 이동 테스트를 시작합니다. **${TEST_DELAY_SECONDS}초 뒤** ${channels.blueVC} 로 이동합니다.`);

    for (let s = TEST_DELAY_SECONDS - 1; s >= 1; s--) {
      await sleep(1000);
      await interaction.editReply(`🧪 음성 이동 테스트를 시작합니다. **${s}초 뒤** ${channels.blueVC} 로 이동합니다.`);
    }

    await sleep(1000);
    await interaction.editReply(`🧪 ${channels.blueVC} 로 지금 이동합니다...`);

    const result = await voice.moveTeamsToVoice(interaction.guild, [{ discordId: interaction.user.id }], [], channels);

    if (result.movedCount > 0) return interaction.editReply(`✅ 음성 이동 테스트 완료: ${channels.blueVC} 로 정상 이동했습니다.`);
    return interaction.editReply('❌ 이동에 실패했습니다. 봇 권한과 현재 음성 채널 접속 상태를 확인하세요.');
  },
};
