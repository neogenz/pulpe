import { Injectable } from '@nestjs/common';
import type { TransactionImportPreview } from 'pulpe-shared';
import { TransactionImportAnalyzer } from './transaction-import-analyzer';

/** Shows what an import would do. Reads only, writes nothing. */
@Injectable()
export class PreviewTransactionImportUseCase {
  constructor(private readonly analyzer: TransactionImportAnalyzer) {}

  async execute(
    content: string,
    budgetId: string,
  ): Promise<TransactionImportPreview> {
    const { preview } = await this.analyzer.analyze(content, budgetId);
    return preview;
  }
}
