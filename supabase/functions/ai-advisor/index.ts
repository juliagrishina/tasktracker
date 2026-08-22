import { groqProvider } from './groq-provider.ts';

/**
 * Server-side boundary reserved for the future Epic 10 AI advisor.
 *
 * The provider is intentionally inactive. No request can reach Groq from
 * this function until a later, separately approved Epic 10 implementation.
 */
Deno.serve(() => Response.json({
  error: 'AI provider is disabled.',
  enabled: groqProvider.enabled,
}, { status: 503 }));
