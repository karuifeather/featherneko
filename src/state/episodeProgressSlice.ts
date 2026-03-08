import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/** Key: "malId-episodeNumber", value: resume position in seconds */
interface EpisodeProgressState {
  byKey: Record<string, number>;
}

const initialState: EpisodeProgressState = {
  byKey: {},
};

function progressKey(malId: number, episodeNumber: number): string {
  return `${malId}-${episodeNumber}`;
}

const episodeProgressSlice = createSlice({
  name: 'episodeProgress',
  initialState,
  reducers: {
    setEpisodeProgress: (
      state,
      action: PayloadAction<{ malId: number; episodeNumber: number; seconds: number }>
    ) => {
      const { malId, episodeNumber, seconds } = action.payload;
      if (seconds <= 0) return;
      state.byKey[progressKey(malId, episodeNumber)] = seconds;
    },
    clearProgressForAnime: (state, action: PayloadAction<number>) => {
      const malId = action.payload;
      Object.keys(state.byKey).forEach((key) => {
        if (key.startsWith(`${malId}-`)) delete state.byKey[key];
      });
    },
  },
});

export const { setEpisodeProgress, clearProgressForAnime } = episodeProgressSlice.actions;

export function selectEpisodeProgress(
  state: { episodeProgress: EpisodeProgressState },
  malId: number,
  episodeNumber: number
): number {
  const key = progressKey(malId, episodeNumber);
  const s = state.episodeProgress.byKey[key];
  return typeof s === 'number' && s > 0 ? s : 0;
}

export default episodeProgressSlice.reducer;
