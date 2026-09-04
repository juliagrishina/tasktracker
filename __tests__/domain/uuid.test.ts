import { createUuid, isUuid, stableLegacyUuid } from '../../src/domain/uuid';

describe('UUID identifiers', () => {
  test('creates RFC 4122 v4 identifiers without browser crypto', () => {
    const identifier = createUuid(() => 0.25);

    expect(isUuid(identifier)).toBe(true);
    expect(identifier[14]).toBe('4');
  });

  test('maps a legacy identifier deterministically to a UUID', () => {
    const first = stableLegacyUuid('task_items', 'task-123');

    expect(first).toBe(stableLegacyUuid('task_items', 'task-123'));
    expect(first).not.toBe(stableLegacyUuid('projects', 'task-123'));
    expect(isUuid(first)).toBe(true);
  });
});
