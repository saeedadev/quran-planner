import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Content } from 'pdfmake';

const root = dirname(fileURLToPath(import.meta.url));
const outputPath = `${root}/../dev/pdf-trial.pdf`;

const regular = `${root}/../src/pdf/fonts/IBMPlexSansArabic-Regular.ttf`;
const bold = `${root}/../src/pdf/fonts/IBMPlexSansArabic-Bold.ttf`;

interface TrialDocumentDefinition {
  pageSize: 'A4';
  pageMargins: [number, number, number, number];
  defaultStyle: { font: string; fontSize: number };
  content: Content[];
  styles: Record<string, { fontSize?: number; bold?: boolean; fillColor?: string }>;
}

const docDefinition: TrialDocumentDefinition = {
  pageSize: 'A4',
  pageMargins: [40, 48, 40, 48],
  defaultStyle: { font: 'IBM Plex Sans Arabic', fontSize: 12 },
  content: [
    { text: 'تواسع — تجربة PDF العربية', style: 'title', alignment: 'center' },
    { text: 'جدول تجريبي لأيام خطة الحفظ (ترتيب الأعمدة من اليمين إلى اليسار)', alignment: 'center', margin: [0, 4, 0, 18] },
    {
      table: {
        headerRows: 1,
        widths: ['12%', '16%', '24%', '24%', '24%'],
        body: [
          [
            { text: 'التاريخ', style: 'header' },
            { text: 'النوع', style: 'header' },
            { text: 'الحفظ الجديد', style: 'header' },
            { text: 'المراجعة الصغرى', style: 'header' },
            { text: 'المراجعة الكبرى', style: 'header' },
          ],
          [{ text: '2026-09-01', alignment: 'center' }, 'دراسة', '1:1 ← 1:7', '1:1 ← 1:7', '—'],
          [{ text: '2026-09-02', alignment: 'center' }, 'دراسة', '2:1 ← 2:5', '2:1 ← 2:8', '1:1 ← 1:3'],
          [{ text: '2026-09-05', alignment: 'center' }, 'تثبيت', '—', '2:1 ← 2:24', '—'],
          [{ text: '2026-09-06', alignment: 'center' }, 'إجازة', '—', '—', '—'],
        ],
      },
      layout: 'lightHorizontalLines',
    },
    {
      text: 'عبارة يوم الإجازة: «تَعَاهَدُوا هذا القُرْآنَ، فَوَالذي نَفْسُ مُحَمَّدٍ بِيَدِهِ لَهُوَ أشَدُّ تَفَلُّتاً مِنَ الإِبِلِ في عُقُلِهَا»',
      margin: [0, 20, 0, 0],
    },
  ],
  styles: {
    title: { fontSize: 20, bold: true },
    header: { bold: true, fillColor: '#e6f2ee' },
  },
};

const pdfMake = ((await import('pdfmake')) as { default: unknown }).default as {
  fonts: Record<string, { normal: string; bold: string }>;
  setLocalAccessPolicy: (callback: (path: string) => boolean) => void;
  setUrlAccessPolicy: (callback: (url: string) => boolean) => void;
  createPdf: (definition: TrialDocumentDefinition, options?: unknown) => { write: (path: string) => Promise<void> };
};

pdfMake.setLocalAccessPolicy(() => true);
pdfMake.setUrlAccessPolicy(() => true);
pdfMake.fonts = {
  'IBM Plex Sans Arabic': { normal: regular, bold },
};

await pdfMake.createPdf(docDefinition).write(outputPath);
console.log(`pdf trial written to ${outputPath}`);
