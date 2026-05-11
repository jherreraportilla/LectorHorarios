import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export async function extractPositionedText(file: File): Promise<PositionedText[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const result: PositionedText[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const t = item as {
        str: string;
        transform: number[];
        width: number;
        height: number;
      };
      result.push({
        str: t.str,
        x: t.transform[4],
        y: t.transform[5],
        width: t.width,
        height: t.height,
        page: pageNumber,
      });
    }
  }

  return result;
}
