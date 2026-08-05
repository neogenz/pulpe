import writeXlsxFile, { type Sheet } from 'write-excel-file/browser';

/**
 * A sheet as `write-excel-file` consumes it. The library parameterises `Sheet`
 * by the type its `images` option accepts, which differs between its node and
 * browser builds; we never attach images, so the parameter only has to satisfy
 * the browser signature.
 */
export type ExcelSheet = Sheet<Blob>;

/**
 * Downloads data as a JSON file
 * @param data - The data to export
 * @param filename - The filename (without extension)
 */
export function downloadAsJsonFile(data: unknown, filename: string): void {
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

/**
 * Downloads sheets as an Excel file
 * @param sheets - The sheets to write, one per workbook tab
 * @param filename - The filename (without extension)
 */
export async function downloadAsExcelFile(
  sheets: ExcelSheet[],
  filename: string,
): Promise<void> {
  await writeXlsxFile(sheets).toFile(`${filename}.xlsx`);
}
