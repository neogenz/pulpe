import { Service } from '@angular/core';
import writeXlsxFile, { type Sheet } from 'write-excel-file/browser';

/**
 * A sheet as `write-excel-file` consumes it. The library parameterises `Sheet`
 * by the type its `images` option accepts, which differs between its node and
 * browser builds; we never attach images, so the parameter only has to satisfy
 * the browser signature.
 */
export type ExcelSheet = Sheet<Blob>;

/**
 * Hands a file to the browser. Both methods end in a save a test can neither
 * perform nor observe, which is why callers inject this rather than call the
 * download directly: a spec substitutes the service and asserts *what* would be
 * written without writing it.
 */
@Service()
export class FileDownloadService {
  /** Serialises `data` as JSON and downloads it as `<filename>.json`. */
  asJson(data: unknown, filename: string): void {
    const exportData = JSON.stringify(data, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    try {
      link.href = url;
      link.download = `${filename}.json`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  }

  /** Writes one workbook holding every sheet, as `<filename>.xlsx`. */
  async asExcel(sheets: ExcelSheet[], filename: string): Promise<void> {
    await writeXlsxFile(sheets).toFile(`${filename}.xlsx`);
  }
}
