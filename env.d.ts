/**
 * Type declaration for react-native-dotenv (@env).
 * Values are injected at build time from .env; all are optional at compile time.
 */
declare module '@env' {
  export const MAL_CLIENT_ID: string | undefined;
  export const ANIMEAPI_URL: string | undefined;
  export const STREAM_PROXY_URL: string | undefined;
  export const DEV_STREAM_URL: string | undefined;
  export const DEV_STREAM_REFERER: string | undefined;
  export const DEV_STREAM_ORIGIN: string | undefined;
  export const DEV_STREAM_USER_AGENT: string | undefined;
  export const PASSWORD_HASH: string | undefined;
}
