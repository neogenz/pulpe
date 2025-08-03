import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  EnhancedLoggerService,
  LogOperation,
  LogPerformance,
  LogErrors,
  LogAudit,
} from './index';

/**
 * Example service demonstrating enhanced logging usage patterns
 * This shows how to integrate the logging infrastructure into your services
 */
@Injectable()
export class ExampleBudgetService {
  constructor(
    @InjectPinoLogger(ExampleBudgetService.name)
    private readonly logger: PinoLogger,
    private readonly enhancedLogger: EnhancedLoggerService,
  ) {}

  /**
   * Example 1: Manual operation tracking
   */
  async createBudgetManual(
    userId: string,
    budgetData: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) {
    const operationId = this.enhancedLogger.startOperation('budget.create', {
      userId,
      budgetYear: budgetData.year,
      budgetMonth: budgetData.month,
    });

    try {
      // Simulate budget creation
      const budget = await this.simulateDbOperation(budgetData);

      this.enhancedLogger.completeOperation(operationId, {
        budgetId: budget.id,
        totalAmount: budget.totalAmount,
      });

      return budget;
    } catch {
      this.enhancedLogger.failOperation(operationId, error as Error, {
        budgetData: JSON.stringify(budgetData),
      });
      throw error;
    }
  }

  /**
   * Example 2: Using the @LogOperation decorator
   */
  @LogOperation('budget.update')
  @LogAudit({
    action: 'update_budget',
    resourceType: 'budget',
    includeResult: true,
  })
  async updateBudgetWithDecorator(
    budgetId: string,
    updates: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
    user: { id: string },
  ) {
    // The decorator automatically tracks this operation
    return this.simulateDbOperation({ id: budgetId, ...updates });
  }

  /**
   * Example 3: Performance monitoring
   */
  @LogPerformance({ warnThreshold: 50, errorThreshold: 200 })
  async calculateBudgetBalance(budgetId: string) {
    // Simulate a calculation that might be slow
    await this.simulateSlowOperation(100);
    return { budgetId, balance: 1000 };
  }

  /**
   * Example 4: Error logging with sensitive data redaction
   */
  @LogErrors({ sensitiveParams: [2] }) // Redact the third parameter (creditCard)
  async processBudgetPayment(
    budgetId: string,
    amount: number,
    creditCard: string,
  ) {
    if (!creditCard.startsWith('4')) {
      throw new Error('Invalid credit card');
    }
    return { success: true, transactionId: 'txn_123' };
  }

  /**
   * Example 5: Command/Query pattern logging
   */
  async createBudgetWithCommand(
    userId: string,
    data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) {
    return this.enhancedLogger.logCommand(
      'CreateBudget',
      { userId, templateId: data.templateId },
      async () => {
        // Business logic here
        const budget = await this.simulateDbOperation(data);

        // Additional structured logging
        this.enhancedLogger.logWithContext(
          'info',
          'Budget created successfully',
          {
            userId,
            budgetId: budget.id,
            budgetPeriod: `${data.year}-${data.month}`,
          },
        );

        return budget;
      },
    );
  }

  /**
   * Example 6: Query logging with result metrics
   */
  async findUserBudgets(
    userId: string,
    filters?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ) {
    return this.enhancedLogger.logQuery(
      'FindUserBudgets',
      { userId, filters },
      async () => {
        const budgets = await this.simulateFindBudgets(userId, filters);

        // Log analytics
        this.enhancedLogger.logAnalytics('budgets_queried', {
          userId,
          resultCount: budgets.length,
          hasFilters: !!filters,
        });

        return budgets;
      },
    );
  }

  /**
   * Example 7: Audit trail for compliance
   */
  async deleteBudget(budgetId: string, userId: string, reason: string) {
    const operationId = this.enhancedLogger.startOperation('budget.delete', {
      userId,
      budgetId,
    });

    try {
      // Perform deletion
      await this.simulateDbOperation({ delete: budgetId });

      // Log audit trail
      this.enhancedLogger.logAudit(
        'budget_deleted',
        {
          budgetId,
          deletedBy: userId,
          deletedAt: new Date().toISOString(),
          reason,
        },
        { userId, entityId: budgetId },
      );

      this.enhancedLogger.completeOperation(operationId, {
        success: true,
      });

      return { success: true, message: 'Budget deleted' };
    } catch {
      this.enhancedLogger.failOperation(operationId, error as Error);
      throw error;
    }
  }

  /**
   * Example 8: Sampled logging for high-volume operations
   */
  async processTransaction(transactionId: string, amount: number) {
    // Log only 10% of transactions to reduce log volume
    this.enhancedLogger.logSampled(0.1, 'debug', 'Processing transaction', {
      transactionId,
      amount,
    });

    return { processed: true };
  }

  /**
   * Example 9: Child logger with preset context
   */
  async batchProcessBudgets(budgetIds: string[], userId: string) {
    // Create a child logger with user context
    const userLogger = this.enhancedLogger.createChildLogger({ userId });

    for (const budgetId of budgetIds) {
      userLogger.logWithContext('info', 'Processing budget in batch', {
        budgetId,
        batchSize: budgetIds.length,
      });

      await this.processSingleBudget(budgetId);
    }

    return { processed: budgetIds.length };
  }

  /**
   * Example 10: Performance threshold configuration
   */
  async initializePerformanceMonitoring() {
    // Set custom thresholds for specific operations
    this.enhancedLogger.setPerformanceThreshold('budget.calculate', {
      warn: 100,
      error: 500,
    });

    this.enhancedLogger.setPerformanceThreshold('budget.export', {
      warn: 2000,
      error: 10000,
    });
  }

  // Helper methods for simulation
  private async simulateDbOperation(
    data: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { id: 'budget_123', totalAmount: 5000, ...data };
  }

  private async simulateSlowOperation(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async simulateFindBudgets(
    userId: string,
    filters?: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  ): Promise<any[]> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return [
      { id: 'budget_1', userId, year: 2024, month: 1 },
      { id: 'budget_2', userId, year: 2024, month: 2 },
    ];
  }

  private async processSingleBudget(budgetId: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
