const voice = require('../utils/voice');

const TEST_DELAY_SECONDS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  name: '음성테스트',
  async execute(message) {
    try {
      if (!message.guild) {
        return message.reply('❌ 서버 안에서만 사용할 수 있습니다.');
      }

      if (!message.member.voice.channel) {
        return message.reply('❌ 먼저 아무 음성 채널에 접속한 뒤 다시 시도하세요.');
      }

      const channels = await voice.prepareTeamVoiceChannels(message.guild);
      const status = await message.reply(
        `🧪 음성 이동 테스트를 시작합니다. **${TEST_DELAY_SECONDS}초 뒤** ${channels.blueVC} 로 이동합니다.`,
      );

      for (let secondsLeft = TEST_DELAY_SECONDS - 1; secondsLeft >= 1; secondsLeft -= 1) {
        await sleep(1000);
        await status.edit(
          `🧪 음성 이동 테스트를 시작합니다. **${secondsLeft}초 뒤** ${channels.blueVC} 로 이동합니다.`,
        );
      }

      await sleep(1000);
      await status.edit(`🧪 ${channels.blueVC} 로 지금 이동합니다...`);

      const result = await voice.moveTeamsToVoice(
        message.guild,
        [{ discordId: message.author.id }],
        [],
        channels,
      );

      if (result.movedCount > 0) {
        return status.edit(`✅ 음성 이동 테스트 완료: ${channels.blueVC} 로 정상 이동했습니다.`);
      }

      return status.edit('❌ 이동에 실패했습니다. 봇 권한과 현재 음성 채널 접속 상태를 확인하세요.');
    } catch (error) {
      console.error(error);
      return message.reply('❌ 음성 이동 테스트 중 오류가 발생했습니다.');
    }
  },
};
