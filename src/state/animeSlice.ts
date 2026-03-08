import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Anime, AnimeCharacter, RecommendationEntry } from '@tutkli/jikan-ts';

interface AnimeState {
  animeDetails: { [id: string]: Anime };
  recommendedAnime: { [id: string]: RecommendationEntry[] };
  characters: { [id: string]: AnimeCharacter[] };
  lastUpdated: { [id: string]: string };
}

const initialState: AnimeState = {
  animeDetails: {},
  recommendedAnime: {},
  characters: {},
  lastUpdated: {},
};

const animeSlice = createSlice({
  name: 'anime',
  initialState,
  reducers: {
    setAnimeDetails(state, action: PayloadAction<{ id: string; data: Anime }>) {
      if (!state.animeDetails) {
        state.animeDetails = {}; // Ensure `animeDetails` is initialized
      }
      state.animeDetails[action.payload.id] = action.payload.data;
    },
    setRecommendedAnime(
      state,
      action: PayloadAction<{ id: string; data: RecommendationEntry[] }>
    ) {
      if (!state.recommendedAnime) {
        state.recommendedAnime = {}; // Ensure `recommendedAnime` is initialized
      }
      state.recommendedAnime[action.payload.id] = action.payload.data;
    },
    setCharacters(
      state,
      action: PayloadAction<{ id: string; data: AnimeCharacter[] }>
    ) {
      if (!state.characters) {
        state.characters = {}; // Ensure `characters` is initialized
      }
      state.characters[action.payload.id] = action.payload.data;
    },
    updateLastUpdated(
      state,
      action: PayloadAction<{ id: string; timestamp: string }>
    ) {
      if (!state.lastUpdated) {
        state.lastUpdated = {}; // Ensure `lastUpdated` is initialized
      }
      state.lastUpdated[action.payload.id] = action.payload.timestamp;
    },
  },
});

export const {
  setAnimeDetails,
  setRecommendedAnime,
  setCharacters,
  updateLastUpdated,
} = animeSlice.actions;

export default animeSlice.reducer;
