import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { PositionedText } from './pdfParser';
import { preprocessForOcr } from './imagePreprocess';

const NORMALIZED_PAGE_HEIGHT = 800;

export interface OcrProgress {
  status: string;
  progress: number;
}

let workerPromise: Promise<Worker> | null = null;
let currentMode: 'std' | 'hq' | null = null;
let currentProgressHandler: ((p: OcrProgress) => void) | null = null;

async function getWorker(highQuality: boolean): Promise<Worker> {
  const mode = highQuality ? 'hq' : 'std';
  if (workerPromise && currentMode !== mode) {
    const old = await workerPromise;
    await old.terminate();
    workerPromise = null;
  }
  if (!workerPromise) {
    currentMode = mode;
    workerPromise = (async () => {
      const w = await createWorker('spa', 1, {
        logger: (m) => {
          if (currentProgressHandler && typeof m.progress === 'number') {
            currentProgressHandler({ status: m.status, progress: m.progress });
          }
        },
      });
      await w.setParameters({
        user_defined_dpi: highQuality ? '400' : '300',
        tessedit_pageseg_mode: highQuality ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return w;
    })();
  }
  return workerPromise;
}

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface OcrWord {
  text: string;
  bbox: Bbox;
}

interface OcrLine {
  words?: OcrWord[];
}

interface OcrParagraph {
  lines?: OcrLine[];
}

interface OcrBlock {
  paragraphs?: OcrParagraph[];
}

interface OcrData {
  blocks?: OcrBlock[];
  words?: OcrWord[];
  lines?: OcrLine[];
}

function collectWords(data: OcrData): OcrWord[] {
  if (data.words && data.words.length > 0) return data.words;
  const out: OcrWord[] = [];
  if (data.blocks) {
    for (const block of data.blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          for (const word of line.words ?? []) {
            out.push(word);
          }
        }
      }
    }
  }
  if (out.length === 0 && data.lines) {
    for (const line of data.lines) {
      for (const word of line.words ?? []) {
        out.push(word);
      }
    }
  }
  return out;
}

export async function extractPositionedTextFromImage(
  file: File,
  onProgress?: (p: OcrProgress) => void,
  highQuality = false
): Promise<PositionedText[]> {
  currentProgressHandler = onProgress ?? null;
  try {
    onProgress?.({ status: highQuality ? 'preprocesando (alta calidad)' : 'preprocesando imagen', progress: 0.05 });
    const { blob, height } = await preprocessForOcr(file, highQuality);

    const worker = await getWorker(highQuality);

    const result = await worker.recognize(
      blob,
      {},
      { blocks: true, text: true, hocr: false, tsv: false, box: false, unlv: false, osd: false }
    );

    const data = result.data as unknown as OcrData;
    const words = collectWords(data);

    if (words.length === 0) {
      throw new Error(
        'El OCR no detectó texto en la imagen. Prueba con una foto más nítida o mejor iluminada.'
      );
    }

    const scale = NORMALIZED_PAGE_HEIGHT / height;
    const maxY = Math.max(...words.map((w) => w.bbox.y1));

    const items: PositionedText[] = words
      .filter((w) => w.text && w.text.trim().length > 0)
      .map((w) => {
        const width = (w.bbox.x1 - w.bbox.x0) * scale;
        const heightScaled = (w.bbox.y1 - w.bbox.y0) * scale;
        return {
          str: w.text,
          x: w.bbox.x0 * scale,
          y: (maxY - w.bbox.y0) * scale - heightScaled,
          width,
          height: heightScaled,
          page: 1,
        };
      });

    return items;
  } finally {
    currentProgressHandler = null;
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}