import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ExportData {
  version: string;
  exported_at: string;
  user_id: string;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    templates: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    template_lines: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monthly_budgets: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    budget_lines: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savings_goals: any[];
  };
  metadata: {
    total_templates: number;
    total_budgets: number;
    total_transactions: number;
    total_savings_goals: number;
    date_range: {
      oldest_budget: string | null;
      newest_budget: string | null;
    };
  };
}

export enum ImportMode {
  REPLACE = 'replace',
}

export interface ImportOptions {
  mode?: ImportMode;
  dryRun?: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    templates: number;
    template_lines: number;
    monthly_budgets: number;
    budget_lines: number;
    transactions: number;
    savings_goals: number;
  };
  errors?: string[];
  warnings?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DataTransferService {
  readonly #http = inject(HttpClient);
  readonly #apiUrl = `${environment.backendUrl}/data-transfer`;

  /**
   * Export all user data as JSON
   */
  exportUserData(): Observable<ExportData> {
    return this.#http.get<ExportData>(`${this.#apiUrl}/export`).pipe(
      catchError((error) => {
        console.error('Error exporting data:', error);
        return throwError(() => new Error('Failed to export data'));
      }),
    );
  }

  /**
   * Import user data from JSON
   */
  importUserData(
    data: ExportData,
    options?: ImportOptions,
  ): Observable<ImportResult> {
    return this.#http
      .post<ImportResult>(`${this.#apiUrl}/import`, {
        data,
        options: options || { mode: ImportMode.REPLACE, dryRun: false },
      })
      .pipe(
        catchError((error) => {
          console.error('Error importing data:', error);
          return throwError(() => new Error('Failed to import data'));
        }),
      );
  }

  /**
   * Validate import data without actually importing
   */
  validateImportData(
    data: ExportData,
    options?: ImportOptions,
  ): Observable<ImportResult> {
    return this.#http
      .post<ImportResult>(`${this.#apiUrl}/import/validate`, {
        data,
        options: options || { mode: ImportMode.REPLACE },
      })
      .pipe(
        catchError((error) => {
          console.error('Error validating data:', error);
          return throwError(() => new Error('Failed to validate data'));
        }),
      );
  }

  /**
   * Download exported data as a JSON file
   */
  downloadExportedData(data: ExportData, filename?: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      filename || `pulpe-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Read a JSON file and parse it as ExportData
   */
  readImportFile(file: File): Observable<ExportData> {
    return new Observable((observer) => {
      // File size validation (3MB limit)
      const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        observer.error(new Error('File size exceeds 3MB limit'));
        return;
      }

      // File type validation
      if (!file.type.includes('json') && !file.name.endsWith('.json')) {
        observer.error(new Error('Only JSON files are allowed'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content) as ExportData;

          // Basic validation
          if (!data.version || !data.data) {
            observer.error(new Error('Invalid file format'));
            return;
          }

          observer.next(data);
          observer.complete();
        } catch {
          observer.error(new Error('Failed to parse JSON file'));
        }
      };

      reader.onerror = () => {
        observer.error(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }
}
