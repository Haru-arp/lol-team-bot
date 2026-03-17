const riot = require('../riot');

const TIER_POINTS = { IRON: 1, BRONZE: 2, SILVER: 3, GOLD: 4, PLATINUM: 5, EMERALD: 6, DIAMOND: 7, MASTER: 8, GRANDMASTER: 9, CHALLENGER: 10 };
const DIV_BONUS = { I: 0.75, II: 0.5, III: 0.25, IV: 0 };
const LANE_MAP = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

async function analyzePlayer(puuid) {
  const [matchIds, rankData, mastery] = await Promise.all([
    riot.getMatchIds(puuid),
    riot.getRankByPuuid(puuid),
    riot.getChampionMastery(puuid),
  ]);

  const matches = (await Promise.all((matchIds || []).map(id => riot.getMatch(id)))).filter(Boolean);

  // Extract player stats from matches
  const stats = matches.map(m => {
    const p = m.info.participants.find(p => p.puuid === puuid);
    if (!p) return null;
    return {
      lane: LANE_MAP[p.teamPosition] || p.teamPosition,
      kills: p.kills, deaths: p.deaths, assists: p.assists,
      win: p.win,
      totalDamageDealt: p.totalDamageDealtToChampions,
      totalDamageTaken: p.totalDamageTaken,
    };
  }).filter(Boolean);

  // Lane distribution
  const laneCounts = {};
  stats.forEach(s => { laneCounts[s.lane] = (laneCounts[s.lane] || 0) + 1; });
  const total = stats.length || 1;
  const laneStats = {};
  for (const [lane, cnt] of Object.entries(laneCounts)) {
    laneStats[lane] = Math.round((cnt / total) * 100);
  }
  const mainLane = Object.entries(laneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'MID';

  // KDA & win rate
  const totals = stats.reduce((a, s) => ({
    k: a.k + s.kills, d: a.d + s.deaths, a: a.a + s.assists,
    wins: a.wins + (s.win ? 1 : 0),
    dmgDealt: a.dmgDealt + s.totalDamageDealt,
    dmgTaken: a.dmgTaken + s.totalDamageTaken,
  }), { k: 0, d: 0, a: 0, wins: 0, dmgDealt: 0, dmgTaken: 0 });

  const avgKDA = +((totals.k + totals.a) / Math.max(totals.d, 1)).toFixed(2);
  const winRate = Math.round((totals.wins / total) * 100);

  // Play style
  const killPct = totals.k / Math.max(totals.k + totals.a, 1);
  const dmgRatio = totals.dmgDealt / Math.max(totals.dmgTaken, 1);
  let playStyle = 'support';
  if (killPct > 0.45 && dmgRatio > 1.2) playStyle = 'carry';
  else if (dmgRatio < 0.8) playStyle = 'tank';

  // Rank info
  const tier = rankData?.tier || 'IRON';
  const rank = rankData?.rank || 'IV';
  const lp = rankData?.leaguePoints || 0;

  // Score calculation
  const tierPts = (TIER_POINTS[tier] || 1) + (DIV_BONUS[rank] || 0);
  const laneProficiency = (laneCounts[mainLane] || 0) / total;
  const champPoolDepth = Math.min((mastery || []).length / 5, 1);

  const score = +(tierPts * 0.4 + (winRate / 100) * 0.25 + laneProficiency * 0.2 + champPoolDepth * 0.15).toFixed(2);

  return {
    tier, rank, lp, mainLane, laneStats,
    topChampions: (mastery || []).map(m => m.championId),
    avgKDA, winRate, playStyle, score,
  };
}

module.exports = { analyzePlayer };
