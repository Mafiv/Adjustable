import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireSessionUser = vi.fn();
const mockConnectToDatabase = vi.fn();
const mockPortfolioGenerationFindOne = vi.fn();
const mockPortfolioFeedbackCreate = vi.fn();

vi.mock('@/lib/auth-session', () => ({
  requireSessionUser: mockRequireSessionUser,
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: mockConnectToDatabase,
}));

vi.mock('@/lib/db/models', () => ({
  Project: {},
  PortfolioGeneration: {
    findOne: mockPortfolioGenerationFindOne,
  },
  PortfolioFeedback: {
    create: mockPortfolioFeedbackCreate,
  },
}));

vi.mock('@/lib/models', () => ({
  model: {},
  embeddingModel: {},
}));

vi.mock('ai', () => ({
  embed: vi.fn(),
  generateObject: vi.fn(),
}));

const { recordGenerationFeedback } = await import('./vault');

describe('recordGenerationFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSessionUser.mockResolvedValue({ id: 'user_1' });
    mockConnectToDatabase.mockResolvedValue(undefined);
  });

  it('rejects invalid generation id', async () => {
    await expect(
      recordGenerationFeedback({
        generationId: 'bad-id',
        eventType: 'view',
      })
    ).rejects.toThrow('Invalid generationId');
  });

  it('enforces ownership before writing feedback', async () => {
    mockPortfolioGenerationFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(
      recordGenerationFeedback({
        generationId: '507f1f77bcf86cd799439011',
        eventType: 'view',
      })
    ).rejects.toThrow('Generation not found');

    expect(mockPortfolioFeedbackCreate).not.toHaveBeenCalled();
  });

  it('stores feedback for owned generation', async () => {
    mockPortfolioGenerationFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    });

    const result = await recordGenerationFeedback({
      generationId: '507f1f77bcf86cd799439011',
      eventType: 'positive',
      metadata: { note: 'Great fit' },
    });

    expect(result).toEqual({ ok: true });
    expect(mockPortfolioFeedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        generationId: '507f1f77bcf86cd799439011',
        eventType: 'positive',
      })
    );
  });
});
