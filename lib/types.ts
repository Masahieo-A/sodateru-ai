export interface CloudflareEnv {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string;
  GEMINI_API_KEY: string;
  APP_URL?: string;
  TEACHER_ALLOWLIST?: string;
}
