import { describe, expect, it } from 'vitest';
import { parseResumeFile } from '@/lib/resume-parser';

describe('parseResumeFile', () => {
  it('parses plain text uploads', async () => {
    const file = new File(['Jane Doe\nSoftware Engineer\n'], 'resume.txt', {
      type: 'text/plain',
    });

    const parsed = await parseResumeFile(file);
    expect(parsed.detectedType).toBe('text');
    expect(parsed.text).toContain('Jane Doe');
  });

  it('rejects empty text files', async () => {
    const file = new File(['   '], 'resume.txt', { type: 'text/plain' });
    await expect(parseResumeFile(file)).rejects.toThrow(/empty/i);
  });
});
