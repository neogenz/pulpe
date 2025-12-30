const BREADCRUMB_CONTEXT_KEY = 'pulpe-breadcrumb-context';

export interface BreadcrumbContext {
  id: string;
  month: number;
  year: number;
}

export function saveBreadcrumbContext(context: BreadcrumbContext): void {
  sessionStorage.setItem(BREADCRUMB_CONTEXT_KEY, JSON.stringify(context));
}

export function getBreadcrumbContext(id: string): BreadcrumbContext | null {
  try {
    const stored = sessionStorage.getItem(BREADCRUMB_CONTEXT_KEY);
    if (!stored) return null;

    const context = JSON.parse(stored) as BreadcrumbContext;
    return context.id === id ? context : null;
  } catch {
    return null;
  }
}
