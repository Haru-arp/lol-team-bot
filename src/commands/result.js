const { EmbedBuilder } = require('discord.js');
const supabase = require('../supabase');

module.exports = {
  name: '결과',
  async execute(interaction) {
    const winner = interaction.options.getString('승리팀');

    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('guild_id', interaction.guild.id)
      .is('winner', null)
      .order('played_at', { ascending: false })
      .limit(1)
      .single();

    if (!match) return interaction.reply('❌ 기록할 내전이 없습니다.');

    const winSide = winner === '블루승' ? 'blue' : 'red';
    await supabase.from('matches').update({ winner: winSide }).eq('id', match.id);

    const winners = winSide === 'blue' ? match.team1 : match.team2;
    const losers = winSide === 'blue' ? match.team2 : match.team1;

    await Promise.all([
      ...winners.filter(p => !p.discord_id.startsWith('ext_')).map(p => supabase.rpc('increment_wins', { p_discord_id: p.discord_id, p_guild_id: interaction.guild.id })),
      ...losers.filter(p => !p.discord_id.startsWith('ext_')).map(p => supabase.rpc('increment_losses', { p_discord_id: p.discord_id, p_guild_id: interaction.guild.id })),
    ]);

    const embed = new EmbedBuilder()
      .setColor(winSide === 'blue' ? 0x3498db : 0xe74c3c)
      .setTitle(`🏆 ${winner}!`)
      .setDescription('내전 결과가 기록되었습니다.');

    interaction.reply({ embeds: [embed] });
  },
};
