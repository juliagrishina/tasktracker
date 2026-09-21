export const ACCOUNT_ACTION_TICKET_TTL_MS = 10 * 60 * 1000;

export type AccountActionOperation = 'clear_account_data' | 'delete_account';

export type ActionTicketRecord = {
  userId: string;
  operation: AccountActionOperation;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type ActionTicketStore = {
  insert: (record: ActionTicketRecord) => Promise<void>;
  consume: (input: {
    userId: string;
    operation: AccountActionOperation;
    tokenHash: string;
    now: string;
  }) => Promise<'consumed' | 'expired' | 'invalid'>;
};

type ActionTicketServiceOptions = {
  store: ActionTicketStore;
  now?: () => Date;
  createToken?: () => string;
  hashToken: (ticket: string) => Promise<string>;
};

/**
 * Issues and consumes short-lived approvals for destructive account actions.
 * The caller receives the raw value once, while persistent storage sees only
 * its server-keyed hash.  The database implementation must consume atomically.
 */
export function createActionTicketService({
  store,
  now = () => new Date(),
  createToken = createSecureActionTicket,
  hashToken,
}: ActionTicketServiceOptions) {
  return {
    async issue(input: { userId: string; operation: AccountActionOperation }) {
      const issuedAt = now();
      const ticket = createToken();
      const expiresAt = new Date(issuedAt.getTime() + ACCOUNT_ACTION_TICKET_TTL_MS);

      await store.insert({
        userId: input.userId,
        operation: input.operation,
        tokenHash: await hashToken(ticket),
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        consumedAt: null,
      });

      return { ticket, expiresAt: expiresAt.toISOString() };
    },

    async consume(input: { userId: string; operation: AccountActionOperation; ticket: string }) {
      return {
        kind: await store.consume({
          userId: input.userId,
          operation: input.operation,
          tokenHash: await hashToken(input.ticket),
          now: now().toISOString(),
        }),
      };
    },
  };
}

/** Generates an opaque URL-safe token using the Edge Runtime crypto source. */
export function createSecureActionTicket(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * Creates the server-only HMAC hash used for ticket storage.  Supply the
 * pepper from an Edge Function secret; it is deliberately never a client
 * environment value or a committed configuration value.
 */
export function createHmacTicketHasher(pepper: string): (ticket: string) => Promise<string> {
  if (pepper.length < 32) {
    throw new Error('ACCOUNT_ACTION_TICKET_PEPPER must be at least 32 characters long.');
  }

  return async (ticket: string) => {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(pepper),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(ticket));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
}
