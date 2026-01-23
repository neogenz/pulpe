import { writeFileXLSX, type WorkBook } from 'xlsx';

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
 * Downloads a workbook as an Excel file
 * @param workbook - The xlsx WorkBook to export
 * @param filename - The filename (without extension)
 */
export function downloadAsExcelFile(
  workbook: WorkBook,
  filename: string,
): void {
  writeFileXLSX(workbook, `${filename}.xlsx`);
}
