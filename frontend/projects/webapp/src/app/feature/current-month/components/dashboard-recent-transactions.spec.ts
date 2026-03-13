import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, LOCALE_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardRecentTransactions } from './dashboard-recent-transactions';
import type { Transaction } from 'pulpe-shared';
import { setTestInput } from '../../../testing/signal-test-utils';
import { StubFinancialKindDirective } from '../../../testing/stub-directives';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import localeFR from '@angular/common/locales/fr';
import { FinancialKindDirective } from '@ui/financial-kind';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

registerLocaleData(localeDE);
registerLocaleData(localeFR);

const createTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  budgetId: 'budget-1',
  budgetLineId: null,
  name: 'Test Transaction',
  amount: 50,
  kind: 'expense',
  transactionDate: '2026-02-15T12:00:00+01:00',
  category: null,
  createdAt: '2026-02-01T00:00:00+01:00',
  updatedAt: '2026-02-01T00:00:00+01:00',
  checkedAt: null,
  ...overrides,
});

describe('DashboardRecentTransactions', () => {
  let component: DashboardRecentTransactions;
  let fixture: ComponentFixture<DashboardRecentTransactions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardRecentTransactions],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'de-CH' },
      ],
    })
      .overrideComponent(DashboardRecentTransactions, {
        remove: { imports: [FinancialKindDirective] },
        add: { imports: [StubFinancialKindDirective] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardRecentTransactions);
    component = fixture.componentInstance;
    setTestInput(component.transactions, []);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display the empty state when no transactions', () => {
    setTestInput(component.transactions, []);
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.p-8.text-center'));
    expect(emptyState).toBeTruthy();
    expect(emptyState.nativeElement.textContent).toContain(
      'Aucune transaction ce mois',
    );
  });

  it('should render transactions with correct names and amounts', () => {
    const transactions = [
      createTransaction({ id: '1', name: 'Loyer', amount: 1200 }),
      createTransaction({ id: '2', name: 'Courses', amount: 85.5 }),
      createTransaction({
        id: '3',
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
      }),
      createTransaction({
        id: '4',
        name: 'Epargne vacances',
        amount: 200,
        kind: 'saving',
      }),
      createTransaction({ id: '5', name: 'Abonnement', amount: 29.9 }),
    ];

    setTestInput(component.transactions, transactions);
    fixture.detectChanges();

    const nameElements = fixture.debugElement.queryAll(
      By.css('.text-body-medium.font-medium.text-on-surface'),
    );
    expect(nameElements.length).toBe(5);
    expect(nameElements[0].nativeElement.textContent.trim()).toBe('Loyer');
    expect(nameElements[1].nativeElement.textContent.trim()).toBe('Courses');
    expect(nameElements[2].nativeElement.textContent.trim()).toBe('Salaire');
    expect(nameElements[3].nativeElement.textContent.trim()).toBe(
      'Epargne vacances',
    );
    expect(nameElements[4].nativeElement.textContent.trim()).toBe('Abonnement');

    const amountElements = fixture.debugElement.queryAll(
      By.css('.text-label-large.font-semibold'),
    );
    expect(amountElements.length).toBe(5);
    expect(amountElements[0].nativeElement.textContent).toContain('1\u2019200');
    expect(amountElements[2].nativeElement.textContent).toContain('5\u2019000');
  });

  it('should display correct icons for each transaction kind', () => {
    const transactions = [
      createTransaction({ id: '1', kind: 'income', name: 'Salaire' }),
      createTransaction({ id: '2', kind: 'expense', name: 'Courses' }),
      createTransaction({ id: '3', kind: 'saving', name: 'Epargne' }),
    ];

    setTestInput(component.transactions, transactions);
    fixture.detectChanges();

    // Select only icons inside the list container, not the header icon
    const listContainer = fixture.debugElement.query(
      By.css('.bg-surface-container-low'),
    );
    const listIcons = listContainer.queryAll(By.css('mat-icon'));

    expect(listIcons.length).toBe(3);
    expect(listIcons[0].nativeElement.textContent.trim()).toBe('arrow_upward');
    expect(listIcons[1].nativeElement.textContent.trim()).toBe(
      'arrow_downward',
    );
    expect(listIcons[2].nativeElement.textContent.trim()).toBe('savings');
  });

  it('should format amounts as CHF currency', () => {
    const transactions = [
      createTransaction({
        id: '1',
        name: 'Loyer',
        amount: 1234.56,
        kind: 'expense',
      }),
    ];

    setTestInput(component.transactions, transactions);
    fixture.detectChanges();

    const amountEl = fixture.debugElement.query(
      By.css('.text-label-large.font-semibold'),
    );
    expect(amountEl.nativeElement.textContent).toContain('1\u2019235');
    expect(amountEl.nativeElement.textContent).toContain('CHF');
  });

  it('should display amounts for each transaction kind', () => {
    const transactions = [
      createTransaction({
        id: '1',
        kind: 'income',
        name: 'Salaire',
        amount: 100,
      }),
      createTransaction({
        id: '2',
        kind: 'expense',
        name: 'Loyer',
        amount: 200,
      }),
      createTransaction({
        id: '3',
        kind: 'saving',
        name: 'Epargne',
        amount: 300,
      }),
    ];

    setTestInput(component.transactions, transactions);
    fixture.detectChanges();

    const amountElements = fixture.debugElement.queryAll(
      By.css('.text-label-large.font-semibold'),
    );
    expect(amountElements.length).toBe(3);
    expect(amountElements[0].nativeElement.textContent).toContain('100');
    expect(amountElements[1].nativeElement.textContent).toContain('200');
    expect(amountElements[2].nativeElement.textContent).toContain('300');
  });

  it('should emit viewBudget on "Voir tout" click', () => {
    setTestInput(component.transactions, [
      createTransaction({ id: '1', name: 'A' }),
    ]);
    fixture.detectChanges();

    let emitted = false;
    component.viewBudget.subscribe(() => (emitted = true));

    const button = fixture.debugElement
      .queryAll(By.css('button'))
      .find((el) => el.nativeElement.textContent.trim().includes('Voir tout'));
    expect(button).toBeTruthy();
    button!.nativeElement.click();
    expect(emitted).toBe(true);
  });

  it('should display the transaction count in subtitle', () => {
    const transactions = [
      createTransaction({ id: '1', name: 'A' }),
      createTransaction({ id: '2', name: 'B' }),
      createTransaction({ id: '3', name: 'C' }),
    ];

    setTestInput(component.transactions, transactions);
    fixture.detectChanges();

    const subtitle = fixture.debugElement.query(
      By.css('.text-body-small.text-on-surface-variant'),
    );
    expect(subtitle.nativeElement.textContent).toContain('(3)');
  });
});
