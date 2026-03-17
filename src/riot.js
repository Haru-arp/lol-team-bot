const axios = require('axios');
const { RIOT_API_KEY } = require('./config');

const asia = axios.create({ baseURL: 'https://asia.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const kr = axios.create({ baseURL: 'https://kr.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const ddragon = axios.create({ baseURL: 'https://ddragon.leagueoflegends.com' });

let championNameMapPromise = null;

async function safe(fn) {
  try { return await fn(); } catch (e) { console.error(e.response?.data || e.message); return null; }
}

async function loadChampionNameMap() {
  const { data: versions } = await ddragon.get('/api/versions.json');
  const latestVersion = versions?.[0];
  if (!latestVersion) return {};

  const { data } = await ddragon.get(`/cdn/${latestVersion}/data/ko_KR/champion.json`);
  const champions = Object.values(data?.data || {});

  return champions.reduce((map, champion) => {
    map[Number(champion.key)] = champion.name;
    return map;
  }, {});
}

module.exports = {
  getAccountByRiotId: (gameName, tagLine) =>
    safe(() => asia.get(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`).then(r => r.data)),

  getSummonerByPuuid: (puuid) =>
    safe(() => kr.get(`/lol/summoner/v4/summoners/by-puuid/${puuid}`).then(r => r.data)),

  getRankByPuuid: (puuid) =>
    safe(async () => {
      const { data } = await kr.get(`/lol/league/v4/entries/by-puuid/${puuid}`);
      return data.find(e => e.queueType === 'RANKED_SOLO_5x5') || null;
    }),

  getMatchIds: (puuid, options = 20) => {
    const params = typeof options === 'number'
      ? { count: options }
      : { count: options.count ?? 20, start: options.start, startTime: options.startTime, endTime: options.endTime, queue: options.queue, type: options.type };

    return safe(() => asia.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, { params }).then(r => r.data));
  },

  getMatch: (matchId) =>
    safe(() => asia.get(`/lol/match/v5/matches/${matchId}`).then(r => r.data)),

  getChampionMastery: (puuid, count = 5) =>
    safe(() => kr.get(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top`, { params: { count } }).then(r => r.data)),

  getChampionNameMap: async () => {
    if (!championNameMapPromise) {
      championNameMapPromise = loadChampionNameMap().catch((error) => {
        championNameMapPromise = null;
        console.error(error.response?.data || error.message);
        return {};
      });
    }
    return championNameMapPromise;
  },
};
