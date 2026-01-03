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
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
