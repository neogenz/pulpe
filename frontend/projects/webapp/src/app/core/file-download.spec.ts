import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadAsExcelFile, type ExcelSheet } from './file-download';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Exercises the real `write-excel-file` browser entry point rather than a mock:
 * an API mismatch here (wrong call shape, renamed method) surfaces as a failing
 * test instead of a runtime `TypeError` on the user's export click. jsdom ships
 * no `URL.createObjectURL`, so the object-URL pair is stubbed.
 */
describe('downloadAsExcelFile', () => {
  let downloadedBlob: Blob | undefined;
  let clickedAnchor: HTMLAnchorElement | undefined;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  const sheet: ExcelSheet = {
    sheet: '03-2026',
    columns: [{ width: 25 }, { width: 15 }],
    data: [
      ['BUDGET MARS 2026'],
      ['Loyer', { type: Number, value: 1200, format: '"CHF" #,##0.00' }],
      [
        'Total',
        { type: 'Formula', value: 'SUM(B2:B2)', format: '"CHF" #,##0.00' },
      ],
    ],
  };

  beforeEach(() => {
    downloadedBlob = undefined;
    clickedAnchor = undefined;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      downloadedBlob = blob;
      return 'blob:pulpe-test';
    });
    URL.revokeObjectURL = vi.fn();

    // The library appends the anchor to the body before clicking it, so the
    // document is where to read it back from without aliasing `this`.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {
        clickedAnchor =
          document.body.querySelector<HTMLAnchorElement>('a[download]') ??
          undefined;
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it('should hand the browser a non-empty xlsx blob', async () => {
    await downloadAsExcelFile([sheet], 'pulpe-export-2026-03-01');

    expect(downloadedBlob).toBeInstanceOf(Blob);
    expect(downloadedBlob?.size).toBeGreaterThan(0);
    expect(downloadedBlob?.type).toBe(XLSX_MIME);
  });

  it('should append the xlsx extension to the requested filename', async () => {
    await downloadAsExcelFile([sheet], 'pulpe-export-2026-03-01');

    expect(clickedAnchor?.download).toBe('pulpe-export-2026-03-01.xlsx');
  });

  it('should write one workbook holding every sheet it is given', async () => {
    const second: ExcelSheet = { ...sheet, sheet: '04-2026' };

    await downloadAsExcelFile([sheet, second], 'pulpe-export');

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadedBlob?.size).toBeGreaterThan(0);
  });
});
