const supabase = require('../supabase');

const LANE_MAP = { '탑': 'TOP', '정글': 'JUNGLE', '미드': 'MID', '원딜': 'ADC', '서폿': 'SUPPORT' };

module.exports = {
  name: '라인',
  async execute(interaction) {
    const primary = interaction.options.getString('1순위');
    const secondary = interaction.options.getString('2순위');

    if (!primary && !secondary) {
      const { data } = await supabase
        .from('lane_preferences')
        .select('primary_lane, secondary_lane')
        .eq('discord_id', interaction.user.id)
        .maybeSingle();

      if (!data) return interaction.reply('❌ 라인이 설정되어 있지 않습니다. `/라인 1순위:탑 2순위:미드` 형식으로 등록하세요.');
      return interaction.reply(`🗺️ 현재 라인: 1순위 **${data.primary_lane}**, 2순위 **${data.secondary_lane || '없음'}**`);
    }

    if (!primary || !secondary) return interaction.reply('❌ 1순위와 2순위를 모두 입력하세요.');

    const p = LANE_MAP[primary];
    const s = LANE_MAP[secondary];
    if (!p || !s) return interaction.reply('❌ 올바른 라인: 탑, 정글, 미드, 원딜, 서폿');

    await supabase.from('lane_preferences').upsert({
      discord_id: interaction.user.id,
      primary_lane: p,
      secondary_lane: s,
    }, { onConflict: 'discord_id' });

    interaction.reply(`✅ 라인 설정 완료: 1순위 **${primary}**, 2순위 **${secondary}**`);
  },
};
