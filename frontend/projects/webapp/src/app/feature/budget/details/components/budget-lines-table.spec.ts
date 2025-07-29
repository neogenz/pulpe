import { BudgetLinesTable } from './budget-lines-table';
import { type BudgetLine } from '@pulpe/shared';
import { vi } from 'vitest';

describe('BudgetLinesTable', () => {
  let component: BudgetLinesTable;

  // NOTE: Due to Angular 20 input.required() limitations with TestBed,
  // we're focusing on testing the component's public methods directly.
  // The component's behavior is fully tested in integration tests.
  // Mock data is not needed for these unit tests since we're testing
  // component methods in isolation.

  beforeEach(() => {
    component = new BudgetLinesTable();
  });

  describe('Component Methods', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have required properties and methods', () => {
      expect(component.budgetLines).toBeDefined();
      expect(component.operationsInProgress).toBeDefined();
      expect(component.updateClicked).toBeDefined();
      expect(component.deleteClicked).toBeDefined();
      expect(component.editingLines).toBeDefined();
      expect(component.editForms).toBeDefined();
    });

    it('should track editing state', () => {
      const lineId = 'test-line-1';

      // Initially not editing
      expect(component.editingLines().has(lineId)).toBe(false);

      // Start editing
      component.editingLines.update((lines) => {
        lines.add(lineId);
        return new Set(lines);
      });

      // Should be editing
      expect(component.editingLines().has(lineId)).toBe(true);
    });

    it('should manage edit forms', () => {
      const lineId = 'test-line-1';
      const editData = {
        id: lineId,
        name: 'Test Line',
        amount: 100,
      };

      // Add edit form
      component.editForms[lineId] = editData;

      // Should have edit form
      expect(component.editForms[lineId]).toEqual(editData);

      // Remove edit form
      delete component.editForms[lineId];

      // Should not have edit form
      expect(component.editForms[lineId]).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    it('should format amount correctly', () => {
      expect(component.formatAmount(1234.56)).toBe("1'234.56");
      expect(component.formatAmount(1000)).toBe("1'000.00");
      expect(component.formatAmount(0)).toBe('0.00');
      expect(component.formatAmount(999999.99)).toBe("999'999.99");
    });

    it('should get correct icon for budget line type', () => {
      expect(component.getIcon('INCOME')).toBe('trending_up');
      expect(component.getIcon('FIXED_EXPENSE')).toBe('trending_down');
      expect(component.getIcon('SAVINGS_CONTRIBUTION')).toBe('savings');
    });

    it('should get correct recurrence label', () => {
      expect(component.getRecurrenceLabel('fixed')).toBe('Tous les mois');
      expect(component.getRecurrenceLabel('one_off')).toBe('Une seule fois');
      expect(component.getRecurrenceLabel('variable')).toBe('Variable');
    });

    it('should get correct type label', () => {
      expect(component.getTypeLabel('INCOME')).toBe('Revenu');
      expect(component.getTypeLabel('FIXED_EXPENSE')).toBe('Dépense');
      expect(component.getTypeLabel('SAVINGS_CONTRIBUTION')).toBe('Épargne');
    });
  });

  describe('Edit Mode Logic', () => {
    it('should check if line is being edited', () => {
      const lineId = 'test-line';

      // Initially false
      expect(component.isEditing(lineId)).toBe(false);

      // Add to editing set
      component.editingLines.update((lines) => {
        lines.add(lineId);
        return new Set(lines);
      });

      // Should be true
      expect(component.isEditing(lineId)).toBe(true);
    });

    it('should start editing a line', () => {
      const line: BudgetLine = {
        id: 'test-line',
        budgetId: 'budget-1',
        name: 'Test Expense',
        amount: 250,
        kind: 'FIXED_EXPENSE',
        recurrence: 'fixed',
      };

      // Start editing
      component.startEditing(line);

      // Should be in editing mode
      expect(component.editingLines().has(line.id)).toBe(true);

      // Should have edit form with correct values
      expect(component.editForms[line.id]).toEqual({
        id: line.id,
        name: line.name,
        amount: line.amount,
      });
    });

    it('should cancel editing', () => {
      const lineId = 'test-line';

      // Setup editing state
      component.editingLines.update((lines) => {
        lines.add(lineId);
        return new Set(lines);
      });
      component.editForms[lineId] = {
        id: lineId,
        name: 'Test',
        amount: 100,
      };

      // Cancel editing
      component.cancelEditing(lineId);

      // Should not be editing
      expect(component.editingLines().has(lineId)).toBe(false);

      // Should not have edit form
      expect(component.editForms[lineId]).toBeUndefined();
    });

    it('should validate edit form before saving', () => {
      const lineId = 'test-line';

      // Test invalid name
      component.editForms[lineId] = {
        id: lineId,
        name: '',
        amount: 100,
      };
      expect(component.isEditFormValid(lineId)).toBe(false);

      // Test invalid amount
      component.editForms[lineId] = {
        id: lineId,
        name: 'Valid Name',
        amount: -100,
      };
      expect(component.isEditFormValid(lineId)).toBe(false);

      // Test valid form
      component.editForms[lineId] = {
        id: lineId,
        name: 'Valid Name',
        amount: 100,
      };
      expect(component.isEditFormValid(lineId)).toBe(true);
    });
  });

  describe('Output Events', () => {
    it('should emit update event with correct data', () => {
      const lineId = 'test-line';
      const updateSpy = vi.fn();

      // Subscribe to output
      component.updateClicked.subscribe(updateSpy);

      // Setup edit form
      component.editForms[lineId] = {
        id: lineId,
        name: 'Updated Name',
        amount: 300,
      };
      component.editingLines.update((lines) => {
        lines.add(lineId);
        return new Set(lines);
      });

      // Save edit
      component.saveEdit(lineId);

      // Should emit update event
      expect(updateSpy).toHaveBeenCalledWith({
        id: lineId,
        update: {
          name: 'Updated Name',
          amount: 300,
        },
      });

      // Should exit edit mode
      expect(component.editingLines().has(lineId)).toBe(false);
    });

    it('should emit delete event', () => {
      const lineId = 'test-line';
      const deleteSpy = vi.fn();

      // Subscribe to output
      component.deleteClicked.subscribe(deleteSpy);

      // Trigger delete
      component.onDelete(lineId);

      // Should emit delete event
      expect(deleteSpy).toHaveBeenCalledWith(lineId);
    });
  });
});
