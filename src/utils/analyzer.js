const riot = require('../riot');
const { CURRENT_SEASON_START } = require('../config');
const { DIV_BONUS, TIER_POINTS, resolveTierInfo } = require('./tier');
const LANE_MAP = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

function getSeasonStartTimestamp() {
  if (CURRENT_SEASON_START) {
    const parsed = Date.parse(CURRENT_SEASON_START);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
}

async function getSeasonRankedMatchIds(puuid, startTime, maxMatches = 300) {
  const pageSize = 100;
  const maxPages = Math.ceil(maxMatches / pageSize);
  const ids = [];

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await riot.getMatchIds(puuid, {
      start: page * pageSize,
      count: Math.min(pageSize, maxMatches - ids.length),
      startTime,
      type: 'ranked',
    });

    if (!batch?.length) break;
    ids.push(...batch);
    if (batch.length < pageSize || ids.length >= maxMatches) break;
  }

  return ids;
}

async function analyzePlayer(puuid, options = {}) {
  const [matchIds, rankData, mastery, championNameMap] = await Promise.all([
    riot.getMatchIds(puuid),
    riot.getRankByPuuid(puuid),
    riot.getChampionMastery(puuid),
    riot.getChampionNameMap(),
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

  const topChampions = (mastery || [])
    .slice(0, 3)
    .map((champion) => ({
      name: championNameMap?.[champion.championId] || `ID ${champion.championId}`,
      masteryLevel: champion.championLevel,
      points: champion.championPoints,
    }));

  let seasonTopChampions = [];
  let seasonMatchCount = 0;
  let hasRecentRankedMatches = false;
  if (options.includeSeasonTopChampions) {
    const seasonStartTime = Math.floor(getSeasonStartTimestamp() / 1000);
    const seasonMatchIds = await getSeasonRankedMatchIds(
      puuid,
      seasonStartTime,
      options.seasonMatchCount ?? 300,
    );
    seasonMatchCount = seasonMatchIds.length;
    const seasonMatches = (await Promise.all((seasonMatchIds || []).map((id) => riot.getMatch(id)))).filter(Boolean);
    const seasonChampionCounts = {};

    seasonMatches.forEach((match) => {
      const participant = match.info.participants.find((player) => player.puuid === puuid);
      if (!participant?.championName) return;
      seasonChampionCounts[participant.championName] = (seasonChampionCounts[participant.championName] || 0) + 1;
    });

    seasonTopChampions = Object.entries(seasonChampionCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    if (!seasonMatchCount) {
      const recentRankedMatchIds = await riot.getMatchIds(puuid, { count: 20, type: 'ranked' });
      hasRecentRankedMatches = Boolean(recentRankedMatchIds?.length);
    }
  }

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
  const { tier, rank, lp, tierSource } = resolveTierInfo(rankData, options.tierOverride);

  // Score calculation
  const tierPts = (TIER_POINTS[tier] ?? 0) + (DIV_BONUS[rank] || 0);
  const laneProficiency = (laneCounts[mainLane] || 0) / total;
  const champPoolDepth = Math.min((mastery || []).length / 5, 1);

  const score = +(tierPts * 0.4 + laneProficiency * 0.2 + champPoolDepth * 0.15).toFixed(2);

  return {
    tier, rank, lp, mainLane, laneStats,
    tierSource,
    topChampions,
    seasonTopChampions,
    seasonMatchCount,
    hasRecentRankedMatches,
    avgKDA, winRate, playStyle, score,
  };
}

module.exports = { analyzePlayer };
