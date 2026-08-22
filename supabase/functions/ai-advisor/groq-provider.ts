/**
 * Server-only configuration for the future Epic 10 AI provider.
 *
 * This provider is deliberately disabled. It does not read a secret,
 * construct an API client, or make network requests. Production activation
 * will obtain GROQ_API_KEY exclusively from the Edge Function environment.
 */
export const groqProvider = {
  enabled: false,
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-120b',
} as const;
