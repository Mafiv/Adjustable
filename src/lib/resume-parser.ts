import { PDFParse } from 'pdf-parse';

type ParsedResume = {
  text: string;
  detectedType: 'pdf' | 'text';
};

const MAX_RESUME_TEXT = 80_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PDF_PARSE_TIMEOUT_MS = 45_000;

function truncateText(input: string) {
  if (input.length <= MAX_RESUME_TEXT) {
    return input;
  }
  return input.slice(0, MAX_RESUME_TEXT);
}

function normalizeExtractedText(input: string) {
  return input.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function parsePdfTextFromBuffer(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await withTimeout(
      parser.getText({
        parseHyperlinks: false,
        parsePageInfo: false,
      }),
      PDF_PARSE_TIMEOUT_MS,
      'PDF parsing timed out. Try a simpler PDF or upload a .txt export of your resume.'
    );

    return normalizeExtractedText(result.text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function assertFileSize(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Resume file is too large. Please upload a PDF under 10 MB.');
  }
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  assertFileSize(file);

  const mime = file.type.toLowerCase();

  if (mime.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const parsedText = await parsePdfTextFromBuffer(bytes);

      if (!parsedText) {
        throw new Error(
          'No text found in this PDF. It may be scanned/image-only — export a text-based PDF or upload .txt/.md instead.'
        );
      }

      return {
        text: truncateText(parsedText),
        detectedType: 'pdf',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parse error';
      throw new Error(`PDF parsing failed: ${message}`);
    }
  }

  const text = normalizeExtractedText(await file.text());
  if (!text) {
    throw new Error('Uploaded file is empty.');
  }

  return {
    text: truncateText(text),
    detectedType: 'text',
  };
}

export const RESUME_UPLOAD_LIMITS = {
  maxFileBytes: MAX_FILE_BYTES,
  maxFileLabel: '10 MB',
} as const;
