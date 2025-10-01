import { Injectable, inject } from '@angular/core';
import type { HttpRequest } from '@angular/common/http';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { DemoStorageAdapter } from './demo-storage-adapter';
import { Logger } from '../logging/logger';

/**
 * Route les requêtes HTTP vers les méthodes appropriées du DemoStorageAdapter
 * Parse l'URL et la méthode HTTP pour identifier l'opération
 */
@Injectable({
  providedIn: 'root',
})
export class DemoRequestRouter {
  readonly #demoStorage = inject(DemoStorageAdapter);
  readonly #logger = inject(Logger);

  handleRequest(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
    this.#logger.debug(`🎭 Demo interceptor: ${req.method} ${req.url}`);

    try {
      const route = this.parseRoute(req);
      return this.executeRoute(route, req);
    } catch (error) {
      this.#logger.error('🎭 Demo routing error:', error);
      return throwError(
        () =>
          new HttpErrorResponse({
            error: { message: 'Route démo non trouvée' },
            status: 404,
            statusText: 'Not Found',
            url: req.url,
          }),
      );
    }
  }

  private parseRoute(req: HttpRequest<unknown>): RouteMatch {
    const url = req.url;
    const method = req.method;

    // BUDGETS
    if (url.match(/\/api\/v1\/budgets\/[^/]+\/details$/)) {
      const budgetId = this.extractIdFromUrl(
        url,
        /\/budgets\/([^/]+)\/details/,
      );
      return { type: 'budget-details', method, budgetId };
    }
    if (url.match(/\/api\/v1\/budgets\/[^/]+$/)) {
      const budgetId = this.extractIdFromUrl(url, /\/budgets\/([^/]+)$/);
      return { type: 'budget', method, budgetId };
    }
    if (url.match(/\/api\/v1\/budgets$/)) {
      return { type: 'budgets', method };
    }

    // TRANSACTIONS
    if (url.match(/\/api\/v1\/transactions\/budget\/[^/]+$/)) {
      const budgetId = this.extractIdFromUrl(
        url,
        /\/transactions\/budget\/([^/]+)$/,
      );
      return { type: 'transactions-by-budget', method, budgetId };
    }
    if (url.match(/\/api\/v1\/transactions\/[^/]+$/)) {
      const transactionId = this.extractIdFromUrl(
        url,
        /\/transactions\/([^/]+)$/,
      );
      return { type: 'transaction', method, transactionId };
    }
    if (url.match(/\/api\/v1\/transactions$/)) {
      return { type: 'transactions', method };
    }

    // TEMPLATES (budget-templates)
    if (
      url.match(/\/api\/v1\/budget-templates\/[^/]+\/lines\/bulk-operations$/)
    ) {
      const templateId = this.extractIdFromUrl(
        url,
        /\/budget-templates\/([^/]+)\/lines/,
      );
      return { type: 'template-lines-bulk-operations', method, templateId };
    }
    if (url.match(/\/api\/v1\/budget-templates\/[^/]+\/lines$/)) {
      const templateId = this.extractIdFromUrl(
        url,
        /\/budget-templates\/([^/]+)\/lines/,
      );
      return { type: 'template-lines', method, templateId };
    }
    if (url.match(/\/api\/v1\/budget-templates\/[^/]+\/usage$/)) {
      const templateId = this.extractIdFromUrl(
        url,
        /\/budget-templates\/([^/]+)\/usage/,
      );
      return { type: 'template-usage', method, templateId };
    }
    if (url.match(/\/api\/v1\/budget-templates\/from-onboarding$/)) {
      return { type: 'template-from-onboarding', method };
    }
    if (url.match(/\/api\/v1\/budget-templates\/[^/]+$/)) {
      const templateId = this.extractIdFromUrl(
        url,
        /\/budget-templates\/([^/]+)$/,
      );
      return { type: 'template', method, templateId };
    }
    if (url.match(/\/api\/v1\/budget-templates$/)) {
      return { type: 'templates', method };
    }

    // BUDGET LINES
    if (url.match(/\/api\/v1\/budget-lines\/budget\/[^/]+$/)) {
      const budgetId = this.extractIdFromUrl(
        url,
        /\/budget-lines\/budget\/([^/]+)$/,
      );
      return { type: 'budget-lines-by-budget', method, budgetId };
    }
    if (url.match(/\/api\/v1\/budget-lines\/[^/]+$/)) {
      const lineId = this.extractIdFromUrl(url, /\/budget-lines\/([^/]+)$/);
      return { type: 'budget-line', method, lineId };
    }
    if (url.match(/\/api\/v1\/budget-lines$/)) {
      return { type: 'budget-lines', method };
    }

    throw new Error(`Route non reconnue: ${method} ${url}`);
  }

  private extractIdFromUrl(url: string, pattern: RegExp): string {
    const match = url.match(pattern);
    if (!match || !match[1]) {
      throw new Error(`Impossible d'extraire l'ID depuis: ${url}`);
    }
    return match[1];
  }

  private executeRoute(
    route: RouteMatch,
    req: HttpRequest<unknown>,
  ): Observable<HttpResponse<unknown>> {
    /**
     * Type safety strategy:
     *
     * req.body is 'unknown' from HttpRequest (Angular's type system limitation).
     * Each DemoStorageAdapter method uses strongly-typed parameters from demo-storage-adapter.types.ts.
     *
     * We use 'as never' here which is safer than 'as any':
     * - 'as never' can be assigned to any type (allows compilation)
     * - TypeScript still validates method signatures in DemoStorageAdapter
     * - Runtime validation happens via Zod schemas in DemoStorageAdapter methods
     * - This is a pragmatic solution for HTTP interceptor routing layer
     *
     * The alternative would be runtime type guards, but that would duplicate validation
     * that already happens in DemoStorageAdapter with Zod schemas.
     */

    // BUDGETS
    if (route.type === 'budgets' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getAllBudgets$());
    }
    if (route.type === 'budgets' && route.method === 'POST') {
      return this.wrapResponse(
        this.#demoStorage.createBudget$(req.body as never),
      );
    }
    if (route.type === 'budget' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getBudgetById$(route.budgetId!),
      );
    }
    if (route.type === 'budget' && route.method === 'PATCH') {
      return this.wrapResponse(
        this.#demoStorage.updateBudget$(route.budgetId!, req.body as never),
      );
    }
    if (route.type === 'budget' && route.method === 'DELETE') {
      return this.wrapResponseVoid(
        this.#demoStorage.deleteBudget$(route.budgetId!),
      );
    }
    if (route.type === 'budget-details' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getBudgetWithDetails$(route.budgetId!),
      );
    }

    // TRANSACTIONS
    if (route.type === 'transactions-by-budget' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getTransactionsByBudget$(route.budgetId!),
      );
    }
    if (route.type === 'transactions' && route.method === 'POST') {
      return this.wrapResponse(
        this.#demoStorage.createTransaction$(req.body as never),
      );
    }
    if (route.type === 'transaction' && route.method === 'PATCH') {
      return this.wrapResponse(
        this.#demoStorage.updateTransaction$(
          route.transactionId!,
          req.body as never,
        ),
      );
    }
    if (route.type === 'transaction' && route.method === 'DELETE') {
      return this.wrapResponseVoid(
        this.#demoStorage.deleteTransaction$(route.transactionId!),
      );
    }

    // TEMPLATES
    if (route.type === 'templates' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getAllTemplates$());
    }
    if (route.type === 'templates' && route.method === 'POST') {
      return this.wrapResponse(
        this.#demoStorage.createTemplate$(req.body as never),
      );
    }
    if (route.type === 'template' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getTemplateById$(route.templateId!),
      );
    }
    if (route.type === 'template' && route.method === 'PATCH') {
      return this.wrapResponse(
        this.#demoStorage.updateTemplate$(route.templateId!, req.body as never),
      );
    }
    if (route.type === 'template' && route.method === 'DELETE') {
      return this.wrapResponse(
        this.#demoStorage.deleteTemplate$(route.templateId!),
      );
    }
    if (route.type === 'template-lines' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getTemplateLines$(route.templateId!),
      );
    }
    if (route.type === 'template-lines' && route.method === 'PATCH') {
      return this.wrapResponse(
        this.#demoStorage.updateTemplateLines$(
          route.templateId!,
          req.body as never,
        ),
      );
    }
    if (
      route.type === 'template-lines-bulk-operations' &&
      route.method === 'POST'
    ) {
      return this.wrapResponse(
        this.#demoStorage.bulkOperationsTemplateLines$(
          route.templateId!,
          req.body as never,
        ),
      );
    }
    if (route.type === 'template-from-onboarding' && route.method === 'POST') {
      return this.wrapResponse(
        this.#demoStorage.createTemplate$(req.body as never),
      );
    }

    // BUDGET LINES
    if (route.type === 'budget-lines' && route.method === 'POST') {
      return this.wrapResponse(
        this.#demoStorage.createBudgetLine$(req.body as never),
      );
    }
    if (route.type === 'budget-line' && route.method === 'PATCH') {
      return this.wrapResponse(
        this.#demoStorage.updateBudgetLine$(route.lineId!, req.body as never),
      );
    }
    if (route.type === 'budget-line' && route.method === 'DELETE') {
      return this.wrapResponseVoid(
        this.#demoStorage.deleteBudgetLine$(route.lineId!),
      );
    }
    if (route.type === 'budget-lines-by-budget' && route.method === 'GET') {
      return this.wrapResponse(
        this.#demoStorage.getBudgetLinesByBudget$(route.budgetId!),
      );
    }

    throw new Error(`Unimplemented route: ${route.type} ${route.method}`);
  }

  /**
   * Wrap un Observable<ApiResponse> en Observable<HttpResponse>
   */
  private wrapResponse<T>(obs$: Observable<T>): Observable<HttpResponse<T>> {
    return obs$.pipe(
      map(
        (data) =>
          new HttpResponse({
            body: data,
            status: 200,
            statusText: 'OK',
          }),
      ),
    );
  }

  /**
   * Wrap un Observable<void> en Observable<HttpResponse>
   */
  private wrapResponseVoid(
    obs$: Observable<void>,
  ): Observable<HttpResponse<void>> {
    return obs$.pipe(
      map(
        () =>
          new HttpResponse({
            body: undefined,
            status: 204,
            statusText: 'No Content',
          }),
      ),
    );
  }
}

// Types pour le routing
type RouteMatch =
  | { type: 'budgets'; method: string }
  | { type: 'budget'; method: string; budgetId: string }
  | { type: 'budget-details'; method: string; budgetId: string }
  | { type: 'transactions'; method: string }
  | { type: 'transactions-by-budget'; method: string; budgetId: string }
  | { type: 'transaction'; method: string; transactionId: string }
  | { type: 'templates'; method: string }
  | { type: 'template'; method: string; templateId: string }
  | { type: 'template-lines'; method: string; templateId: string }
  | {
      type: 'template-lines-bulk-operations';
      method: string;
      templateId: string;
    }
  | { type: 'template-from-onboarding'; method: string }
  | { type: 'template-usage'; method: string; templateId: string }
  | { type: 'budget-lines'; method: string }
  | { type: 'budget-lines-by-budget'; method: string; budgetId: string }
  | { type: 'budget-line'; method: string; lineId: string };
