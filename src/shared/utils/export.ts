// Export/Import utilities for GanttApp

import { AppData } from '../types/app';

/**
 * Export app data as JSON file download
 */
export function exportData(data: AppData): void {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gantt-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import app data from JSON file
 * Returns the imported data if valid, null otherwise
 */
export function parseImportedData(fileContent: string): AppData | null {
  try {
    const imported = JSON.parse(fileContent);

    // Validate structure
    if (
      imported.projects &&
      imported.releases &&
      Array.isArray(imported.projects) &&
      Array.isArray(imported.releases)
    ) {
      return imported as AppData;
    }

    return null;
  } catch (error) {
    console.error('Error parsing imported data:', error);
    return null;
  }
}

/**
 * Read a file and return its contents as string
 * Returns a Promise that resolves with the file content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}
