import PDFParser from 'pdf2json';
import type { Output, Page, Text, TextRun } from 'pdf2json';

type ParsedResume = {
  text: string;
  detectedType: 'pdf' | 'text';
};

const MAX_RESUME_TEXT = 80_000;

function truncateText(input: string) {
  if (input.length <= MAX_RESUME_TEXT) {
    return input;
  }
  return input.slice(0, MAX_RESUME_TEXT);
}

function decodePdfToken(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

async function parsePdfTextFromBuffer(buffer: Buffer) {
  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser();

    parser.once('pdfParser_dataError', (error) => {
      const parserError =
        typeof error === 'object' && error !== null && 'parserError' in error
          ? (error as { parserError?: Error }).parserError
          : undefined;
      reject(parserError ?? new Error('Unknown PDF parser error'));
    });

    parser.once('pdfParser_dataReady', (pdfData: Output) => {
      const pages: Page[] = pdfData.Pages ?? [];
      const pageTexts = pages.map((page: Page) => {
        const tokens = (page.Texts ?? []).flatMap((entry: Text) =>
          (entry.R ?? []).map((run: TextRun) => decodePdfToken(run.T ?? ''))
        );
        return tokens.join(' ').replace(/\s+/g, ' ').trim();
      });

      resolve(pageTexts.filter(Boolean).join('\n').trim());
    });

    parser.parseBuffer(buffer);
  });
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  const mime = file.type.toLowerCase();

  if (mime.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const parsedText = await parsePdfTextFromBuffer(bytes);

      if (!parsedText) {
        throw new Error('No text content found in PDF');
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

  const text = await file.text();

  return {
    text: truncateText(text.trim()),
    detectedType: 'text',
  };
}
