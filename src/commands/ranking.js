const { EmbedBuilder } = require('discord.js');
const supabase = require('../supabase');

module.exports = {
  name: '랭킹',
  async execute(message) {
    const { data } = await supabase
      .from('server_stats')
      .select('discord_id, wins, losses')
      .eq('guild_id', message.guild.id);

    const ranked = (data || [])
      .filter((s) => s.wins + s.losses >= 5)
      .map((s) => ({ ...s, rate: ((s.wins / (s.wins + s.losses)) * 100).toFixed(1) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    if (!ranked.length) return message.reply('❌ 아직 랭킹 데이터가 없습니다. (최소 5판)');

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(ranked.map(async (s, i) => {
      const member = await message.guild.members.fetch(s.discord_id).catch(() => null);
      const name = member?.displayName || s.discord_id;
      const medal = medals[i] || `${i + 1}.`;
      return `${medal} **${name}** - ${s.wins}승 ${s.losses}패 (${s.rate}%)`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 내전 랭킹')
      .setDescription(lines.join('\n'));

    message.reply({ embeds: [embed] });
  },
};
