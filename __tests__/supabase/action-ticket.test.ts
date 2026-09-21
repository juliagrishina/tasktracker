import {
  createActionTicketService,
  type ActionTicketRecord,
} from '../../supabase/functions/_shared/action-tickets';

describe('server action tickets', () => {
  test('binds a ticket to its owner and operation and consumes it only once', async () => {
    const store = createMemoryTicketStore();
    const service = createActionTicketService({
      store,
      now: () => new Date('2026-09-03T10:00:00.000Z'),
      createToken: () => 'opaque-ticket',
      hashToken: async () => 'sha256:stored-ticket-hash',
    });

    const issued = await service.issue({ userId: 'user-17', operation: 'clear_account_data' });

    expect(issued.expiresAt).toBe('2026-09-03T10:10:00.000Z');
    expect(store.records[0]).toMatchObject({
      userId: 'user-17',
      operation: 'clear_account_data',
      tokenHash: 'sha256:stored-ticket-hash',
    });
    expect(JSON.stringify(store.records[0])).not.toContain('opaque-ticket');
    await expect(service.consume({ userId: 'user-17', operation: 'delete_account', ticket: issued.ticket })).resolves.toEqual({ kind: 'invalid' });
    await expect(service.consume({ userId: 'user-17', operation: 'clear_account_data', ticket: issued.ticket })).resolves.toEqual({ kind: 'consumed' });
    await expect(service.consume({ userId: 'user-17', operation: 'clear_account_data', ticket: issued.ticket })).resolves.toEqual({ kind: 'invalid' });
  });

  test('does not consume an expired ticket', async () => {
    const store = createMemoryTicketStore();
    let now = new Date('2026-09-03T10:00:00.000Z');
    const service = createActionTicketService({
      store,
      now: () => now,
      createToken: () => 'opaque-ticket',
      hashToken: async () => 'sha256:stored-ticket-hash',
    });
    const issued = await service.issue({ userId: 'user-17', operation: 'delete_account' });
    now = new Date('2026-09-03T10:10:00.000Z');

    await expect(service.consume({ userId: 'user-17', operation: 'delete_account', ticket: issued.ticket })).resolves.toEqual({ kind: 'expired' });
    expect(store.records[0]?.consumedAt).toBeNull();
  });
});

function createMemoryTicketStore() {
  const records: ActionTicketRecord[] = [];

  return {
    records,
    insert: async (record: ActionTicketRecord) => {
      records.push({ ...record });
    },
    consume: async (input: {
      userId: string;
      operation: ActionTicketRecord['operation'];
      tokenHash: string;
      now: string;
    }) => {
      const record = records.find((candidate) =>
        candidate.userId === input.userId
        && candidate.operation === input.operation
        && candidate.tokenHash === input.tokenHash
        && candidate.consumedAt === null,
      );
      if (record === undefined) return 'invalid' as const;
      if (record.expiresAt <= input.now) return 'expired' as const;
      record.consumedAt = input.now;
      return 'consumed' as const;
    },
  };
}
