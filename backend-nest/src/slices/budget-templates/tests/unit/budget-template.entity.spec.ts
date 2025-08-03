import { describe, it, expect } from 'bun:test';
import { BudgetTemplate } from '../../domain/entities/budget-template.entity';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';
import { TemplateLine } from '../../domain/value-objects/template-line.value-object';

describe('BudgetTemplate Entity', () => {
  const createValidInfo = () =>
    TemplateInfo.create({
      name: 'Test Template',
      description: 'Test description',
      isDefault: false,
    }).getValue();

  const createIncomeLine = (name = 'Salary', amount = 5000) =>
    TemplateLine.create({
      name,
      amount,
      kind: 'INCOME',
      recurrence: 'fixed',
    }).getValue();

  const createExpenseLine = (
    name = 'Rent',
    amount = 1200,
    kind: 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' = 'FIXED_EXPENSE',
  ) =>
    TemplateLine.create({
      name,
      amount,
      kind,
      recurrence: kind === 'FIXED_EXPENSE' ? 'fixed' : 'envelope',
    }).getValue();

  describe('create', () => {
    it('should create a valid budget template', () => {
      const info = createValidInfo();
      const lines = [createIncomeLine(), createExpenseLine()];

      const result = BudgetTemplate.create({
        userId: 'user-123',
        info,
        lines,
      });

      expect(result.isSuccess).toBe(true);
      const template = result.getValue();
      expect(template.userId).toBe('user-123');
      expect(template.info).toBe(info);
      expect(template.lines).toHaveLength(2);
    });

    it('should use provided ID when specified', () => {
      const result = BudgetTemplate.create(
        {
          userId: 'user-123',
          info: createValidInfo(),
          lines: [createIncomeLine()],
        },
        'custom-id',
      );

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().id).toBe('custom-id');
    });

    it('should fail without user ID', () => {
      const result = BudgetTemplate.create({
        userId: '',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_BUDGET_TEMPLATE');
    });

    it('should fail without at least one income line', () => {
      const result = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createExpenseLine('Rent'),
          createExpenseLine('Food', 500, 'VARIABLE_EXPENSE'),
        ],
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('NO_INCOME_LINE');
    });

    it('should fail with duplicate line names', () => {
      const result = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary'),
          createIncomeLine('Salary'), // Duplicate name
        ],
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DUPLICATE_LINE_NAMES');
    });

    it('should treat line names as case-insensitive for duplicates', () => {
      const result = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary'),
          createIncomeLine('SALARY'), // Different case, still duplicate
        ],
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DUPLICATE_LINE_NAMES');
    });
  });

  describe('updateInfo', () => {
    it('should update template info', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const newInfo = TemplateInfo.create({
        name: 'Updated Template',
        description: 'New description',
        isDefault: true,
      }).getValue();

      const result = template.updateInfo(newInfo);

      expect(result.isSuccess).toBe(true);
      expect(template.info.name).toBe('Updated Template');
      expect(template.info.isDefault).toBe(true);
    });
  });

  describe('setAsDefault / unsetAsDefault', () => {
    it('should set template as default', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      expect(template.info.isDefault).toBe(false);

      template.setAsDefault();
      expect(template.info.isDefault).toBe(true);
    });

    it('should unset template as default', () => {
      const info = TemplateInfo.create({
        name: 'Default Template',
        description: null,
        isDefault: true,
      }).getValue();

      const template = BudgetTemplate.create({
        userId: 'user-123',
        info,
        lines: [createIncomeLine()],
      }).getValue();

      expect(template.info.isDefault).toBe(true);

      template.unsetAsDefault();
      expect(template.info.isDefault).toBe(false);
    });
  });

  describe('line management', () => {
    it('should add a new line', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const newLine = createExpenseLine('Utilities', 200);
      const result = template.addLine(newLine);

      expect(result.isSuccess).toBe(true);
      expect(template.lines).toHaveLength(2);
      expect(template.lines[1]).toBe(newLine);
    });

    it('should fail to add line with duplicate name', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine('Salary')],
      }).getValue();

      const duplicateLine = createIncomeLine('Salary', 6000);
      const result = template.addLine(duplicateLine);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DUPLICATE_LINE_NAME');
    });

    it('should remove a line', () => {
      const incomeLine = createIncomeLine();
      const expenseLine = createExpenseLine();

      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [incomeLine, expenseLine],
      }).getValue();

      const result = template.removeLine(expenseLine.id);

      expect(result.isSuccess).toBe(true);
      expect(template.lines).toHaveLength(1);
      expect(template.lines[0].id).toBe(incomeLine.id);
    });

    it('should fail to remove non-existent line', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const result = template.removeLine('non-existent-id');

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('LINE_NOT_FOUND');
    });

    it('should fail to remove last income line', () => {
      const incomeLine = createIncomeLine();
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [incomeLine, createExpenseLine()],
      }).getValue();

      const result = template.removeLine(incomeLine.id);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('LAST_INCOME_LINE');
    });

    it('should update a line', () => {
      const line = createIncomeLine('Salary', 5000);
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [line],
      }).getValue();

      const result = template.updateLine(line.id, { amount: 6000 });

      expect(result.isSuccess).toBe(true);
      expect(template.lines[0].amount).toBe(6000);
    });

    it('should fail to update line with duplicate name', () => {
      const line1 = createIncomeLine('Salary');
      const line2 = createExpenseLine('Rent');

      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [line1, line2],
      }).getValue();

      const result = template.updateLine(line2.id, { name: 'Salary' });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('DUPLICATE_LINE_NAME');
    });

    it('should fail to change last income line to expense', () => {
      const incomeLine = createIncomeLine();
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [incomeLine, createExpenseLine()],
      }).getValue();

      const result = template.updateLine(incomeLine.id, {
        kind: 'FIXED_EXPENSE',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('LAST_INCOME_LINE');
    });

    it('should replace all lines', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const newLines = [
        createIncomeLine('New Income', 7000),
        createExpenseLine('New Expense', 1500),
      ];

      const result = template.replaceAllLines(newLines);

      expect(result.isSuccess).toBe(true);
      expect(template.lines).toHaveLength(2);
      expect(template.lines[0].name).toBe('New Income');
    });

    it('should fail to replace with no income lines', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const result = template.replaceAllLines([createExpenseLine()]);

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('NO_INCOME_LINE');
    });
  });

  describe('calculations', () => {
    it('should calculate total income', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary', 5000),
          createIncomeLine('Bonus', 1000),
          createExpenseLine('Rent', 1200),
        ],
      }).getValue();

      expect(template.getTotalIncome()).toBe(6000);
    });

    it('should calculate total expenses', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary', 5000),
          createExpenseLine('Rent', 1200),
          createExpenseLine('Food', 500, 'VARIABLE_EXPENSE'),
        ],
      }).getValue();

      expect(template.getTotalExpenses()).toBe(1700);
    });

    it('should calculate balance', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary', 5000),
          createExpenseLine('Rent', 1200),
          createExpenseLine('Food', 500, 'VARIABLE_EXPENSE'),
        ],
      }).getValue();

      expect(template.getBalance()).toBe(3300); // 5000 - 1700
    });

    it('should get lines by kind', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [
          createIncomeLine('Salary'),
          createIncomeLine('Bonus', 1000),
          createExpenseLine('Rent', 1200, 'FIXED_EXPENSE'),
          createExpenseLine('Food', 500, 'VARIABLE_EXPENSE'),
        ],
      }).getValue();

      const incomeLines = template.getLinesByKind('INCOME');
      const fixedExpenseLines = template.getLinesByKind('FIXED_EXPENSE');
      const variableExpenseLines = template.getLinesByKind('VARIABLE_EXPENSE');

      expect(incomeLines).toHaveLength(2);
      expect(fixedExpenseLines).toHaveLength(1);
      expect(variableExpenseLines).toHaveLength(1);
    });
  });

  describe('business rules', () => {
    it('should allow creating budget when has income and expense', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine(), createExpenseLine()],
      }).getValue();

      expect(template.canCreateBudget()).toBe(true);
    });

    it('should not allow creating budget with only income', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      expect(template.canCreateBudget()).toBe(false);
    });
  });

  describe('duplicate', () => {
    it('should duplicate template with new name', () => {
      const original = BudgetTemplate.create({
        userId: 'user-123',
        info: TemplateInfo.create({
          name: 'Original',
          description: 'Original description',
          isDefault: true,
        }).getValue(),
        lines: [
          createIncomeLine('Salary', 5000),
          createExpenseLine('Rent', 1200),
        ],
      }).getValue();

      const result = original.duplicate('Copy of Original');

      expect(result.isSuccess).toBe(true);
      const duplicate = result.getValue();

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.userId).toBe(original.userId);
      expect(duplicate.info.name).toBe('Copy of Original');
      expect(duplicate.info.description).toBe('Original description');
      expect(duplicate.info.isDefault).toBe(false); // Duplicates are not default
      expect(duplicate.lines).toHaveLength(2);
      expect(duplicate.lines[0].id).not.toBe(original.lines[0].id); // New line IDs
    });

    it('should duplicate template with new user ID', () => {
      const original = BudgetTemplate.create({
        userId: 'user-123',
        info: createValidInfo(),
        lines: [createIncomeLine()],
      }).getValue();

      const result = original.duplicate('Copy', 'user-456');

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().userId).toBe('user-456');
    });
  });

  describe('toSnapshot', () => {
    it('should create a snapshot of the template', () => {
      const template = BudgetTemplate.create({
        userId: 'user-123',
        info: TemplateInfo.create({
          name: 'Test Template',
          description: 'Test description',
          isDefault: true,
        }).getValue(),
        lines: [createIncomeLine(), createExpenseLine()],
      }).getValue();

      const snapshot = template.toSnapshot();

      expect(snapshot.id).toBe(template.id);
      expect(snapshot.userId).toBe('user-123');
      expect(snapshot.name).toBe('Test Template');
      expect(snapshot.description).toBe('Test description');
      expect(snapshot.isDefault).toBe(true);
      expect(snapshot.lines).toHaveLength(2);
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.updatedAt).toBeInstanceOf(Date);
    });
  });
});
