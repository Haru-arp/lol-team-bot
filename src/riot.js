const axios = require('axios');
const { RIOT_API_KEY } = require('./config');

const asia = axios.create({ baseURL: 'https://asia.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const kr = axios.create({ baseURL: 'https://kr.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const ddragon = axios.create({ baseURL: 'https://ddragon.leagueoflegends.com' });
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_RETRIES = 3;

let championNameMapPromise = null;
let activeRequests = 0;
const requestQueue = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dequeueRequest() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) return;
  const next = requestQueue.shift();
  if (!next) return;

  activeRequests += 1;
  next()
    .finally(() => {
      activeRequests -= 1;
      dequeueRequest();
    });
}

function scheduleRequest(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        resolve(await fn());
      } catch (error) {
        reject(error);
      }
    });
    dequeueRequest();
  });
}

async function safe(fn, attempt = 0) {
  try {
    return await scheduleRequest(fn);
  } catch (e) {
    const status = e.response?.status;
    if (status === 429 && attempt < MAX_RETRIES) {
      const retryAfterSeconds = Number(e.response?.headers?.['retry-after']);
      const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 1000 * (attempt + 1);
      await sleep(waitMs);
      return safe(fn, attempt + 1);
    }

    console.error(e.response?.data || e.message);
    return null;
  }
}

async function loadChampionNameMap() {
  const { data: versions } = await scheduleRequest(() => ddragon.get('/api/versions.json'));
  const latestVersion = versions?.[0];
  if (!latestVersion) return {};

  const { data } = await scheduleRequest(() => ddragon.get(`/cdn/${latestVersion}/data/ko_KR/champion.json`));
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
