import { createSelector } from 'reselect';
import { RootState } from '../store';

// Base Selectors
const selectAnimeState = (state: RootState) => state.anime || {};
const selectWatchlistItems = (state: RootState) => state.watchlist.items;
const selectWatchHistoryByAnime = (state: RootState) => state.watchHistory.byAnime;

const selectAnimeId = (_: RootState, animeId: string) => animeId;

export const selectAuthState = (state: RootState) =>
  state.user.isAuthenticated || false;

// Memoized Selectors with Guards
export const selectAnimeDetails = createSelector(
  [selectAnimeState, selectAnimeId],
  (animeState, animeId) => animeState.animeDetails?.[animeId] || null
);

export const selectRecommendedAnime = createSelector(
  [selectAnimeState, selectAnimeId],
  (animeState, animeId) => animeState.recommendedAnime?.[animeId] || []
);

export const selectCharacters = createSelector(
  [selectAnimeState, selectAnimeId],
  (animeState, animeId) => animeState.characters?.[animeId] || []
);

export const selectLastUpdated = createSelector(
  [selectAnimeState, selectAnimeId],
  (animeState, animeId) => animeState.lastUpdated?.[animeId] || null
);

export const selectWatchlistMalIds = createSelector(
  [selectWatchlistItems],
  (items) => items.map((i) => i.malId)
);

const selectAnimeMalId = (_: RootState, animeMalId: string) => animeMalId;

export const selectWatchedEpisodeIdsForAnime = createSelector(
  [selectWatchHistoryByAnime, selectAnimeMalId],
  (byAnime, animeMalId) => byAnime[animeMalId] ?? []
);
