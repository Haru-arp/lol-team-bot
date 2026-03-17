const axios = require('axios');
const { RIOT_API_KEY } = require('./config');

const asia = axios.create({ baseURL: 'https://asia.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });
const kr = axios.create({ baseURL: 'https://kr.api.riotgames.com', headers: { 'X-Riot-Token': RIOT_API_KEY } });

async function safe(fn) {
  try { return await fn(); } catch (e) { console.error(e.response?.data || e.message); return null; }
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

  getMatchIds: (puuid, count = 20) =>
    safe(() => asia.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, { params: { count } }).then(r => r.data)),

  getMatch: (matchId) =>
    safe(() => asia.get(`/lol/match/v5/matches/${matchId}`).then(r => r.data)),

  getChampionMastery: (puuid, count = 5) =>
    safe(() => kr.get(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top`, { params: { count } }).then(r => r.data)),
};
