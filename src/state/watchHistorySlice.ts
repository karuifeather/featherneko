import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/** animeMalId -> set of episode numbers watched */
interface WatchHistoryState {
  byAnime: Record<string, number[]>;
}

const initialState: WatchHistoryState = {
  byAnime: {},
};

const watchHistorySlice = createSlice({
  name: 'watchHistory',
  initialState,
  reducers: {
    markEpisodeWatched: (
      state,
      action: PayloadAction<{ malId: number; episodeNumber: number }>
    ) => {
      const key = String(action.payload.malId);
      if (!state.byAnime[key]) state.byAnime[key] = [];
      if (!state.byAnime[key].includes(action.payload.episodeNumber)) {
        state.byAnime[key].push(action.payload.episodeNumber);
      }
    },
    clearHistoryForAnime: (state, action: PayloadAction<number>) => {
      delete state.byAnime[String(action.payload)];
    },
    clearAllHistory: (state) => {
      state.byAnime = {};
    },
  },
});

export const {
  markEpisodeWatched,
  clearHistoryForAnime,
  clearAllHistory,
} = watchHistorySlice.actions;
export default watchHistorySlice.reducer;
