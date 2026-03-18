const supabase = require('../supabase');

const LANE_MAP = { '탑': 'TOP', '정글': 'JUNGLE', '미드': 'MID', '원딜': 'ADC', '서폿': 'SUPPORT' };

module.exports = {
  name: '라인',
  async execute(message, args) {
    if (args.length === 0) {
      const { data } = await supabase
        .from('lane_preferences')
        .select('primary_lane, secondary_lane')
        .eq('discord_id', message.author.id)
        .maybeSingle();

      if (!data) return message.reply('❌ 라인이 설정되어 있지 않습니다. `!라인 탑 미드` 형식으로 등록하세요.');
      return message.reply(`🗺️ 현재 라인: 1순위 **${data.primary_lane}**, 2순위 **${data.secondary_lane || '없음'}**`);
    }

    if (args.length < 2) return message.reply('❌ 형식: `!라인 [1순위] [2순위]` (탑/정글/미드/원딜/서폿)');

    const primary = LANE_MAP[args[0]];
    const secondary = LANE_MAP[args[1]];
    if (!primary || !secondary) return message.reply('❌ 올바른 라인: 탑, 정글, 미드, 원딜, 서폿');

    await supabase.from('lane_preferences').upsert({
      discord_id: message.author.id,
      primary_lane: primary,
      secondary_lane: secondary,
    }, { onConflict: 'discord_id' });

    message.reply(`✅ 라인 설정 완료: 1순위 **${args[0]}**, 2순위 **${args[1]}**`);
  },
};
