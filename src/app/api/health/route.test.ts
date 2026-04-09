import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

const { connectToDatabase } = await import('@/lib/db');
const { GET } = await import('./route');

describe('GET /api/health', () => {
  it('returns ok payload when db is reachable', async () => {
    vi.mocked(connectToDatabase).mockResolvedValue({} as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('ok');
  });

  it('returns 500 payload when db check fails', async () => {
    vi.mocked(connectToDatabase).mockRejectedValue(new Error('db down'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.message).toContain('db down');
  });
});
