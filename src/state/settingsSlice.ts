import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'dark' | 'light' | 'system';

/** Provider config within an API (id, label, servers). Base URL and adapter come from parent API. */
export interface StreamingProviderConfig {
  id: string;
  label: string;
  servers: readonly string[];
  watchEpisodeIdInQuery?: boolean;
}

/** Top-level streaming API (only AnimeAPI supported). */
export interface StreamingAPIConfig {
  id: string;
  label: string;
  adapterKey: string;
  envKey: string;
  providers: readonly StreamingProviderConfig[];
}

export const STREAMING_APIS: StreamingAPIConfig[] = [
  {
    id: 'animeapi',
    label: 'AnimeAPI (animeapi.net)',
    adapterKey: 'animeapi',
    envKey: 'ANIMEAPI_URL',
    providers: [{ id: 'default', label: 'Default', servers: [] }],
  },
];

export type StreamingAPIId = (typeof STREAMING_APIS)[number]['id'];
export type StreamingProviderId = string;

/** Get providers for the given API id. */
export function getProvidersForApi(apiId: string): StreamingProviderConfig[] {
  const api = STREAMING_APIS.find((a) => a.id === apiId);
  return api ? [...api.providers] : [];
}

/** Get API config by id. */
export function getStreamingApiConfig(apiId: string): StreamingAPIConfig | undefined {
  return STREAMING_APIS.find((a) => a.id === apiId);
}

/** Get provider config within an API. */
export function getProviderConfig(apiId: string, providerId: string): StreamingProviderConfig | undefined {
  const api = STREAMING_APIS.find((a) => a.id === apiId);
  return api?.providers.find((p) => p.id === providerId);
}

interface SettingsState {
  theme: ThemeMode;
  defaultStreamingApi: StreamingAPIId;
  defaultStreamingProvider: StreamingProviderId;
  defaultStreamingServer: string;
}

const initialState: SettingsState = {
  theme: 'dark',
  defaultStreamingApi: 'animeapi',
  defaultStreamingProvider: 'default',
  defaultStreamingServer: '',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.theme = action.payload;
    },
    setDefaultStreamingApi: (state, action: PayloadAction<StreamingAPIId>) => {
      state.defaultStreamingApi = action.payload;
      const api = STREAMING_APIS.find((a) => a.id === action.payload);
      const first = api?.providers?.[0];
      state.defaultStreamingProvider = first?.id ?? '';
      state.defaultStreamingServer = first?.servers?.[0] ?? '';
    },
    setDefaultStreamingProvider: (state, action: PayloadAction<StreamingProviderId>) => {
      state.defaultStreamingProvider = action.payload;
      const api = STREAMING_APIS.find((a) => a.id === state.defaultStreamingApi);
      const provider = api?.providers.find((p) => p.id === action.payload);
      state.defaultStreamingServer = provider?.servers?.[0] ?? '';
    },
    setDefaultStreamingServer: (state, action: PayloadAction<string>) => {
      state.defaultStreamingServer = action.payload;
    },
  },
});

export const { setTheme, setDefaultStreamingApi, setDefaultStreamingProvider, setDefaultStreamingServer } = settingsSlice.actions;
export default settingsSlice.reducer;
