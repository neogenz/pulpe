import type { Tables } from '../../../../types/database.types';
import type { EncryptionPort } from '@modules/encryption/domain/ports/encryption.port';

type TemplateLineRow = Tables<'template_line'>;
type TemplateLine = Omit<TemplateLineRow, 'id' | 'created_at' | 'updated_at'>;

function createLine(
  templateId: string,
  name: string,
  amount: number,
  kind: 'income' | 'expense' | 'saving',
  recurrence: 'fixed' | 'one_off',
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine {
  return {
    template_id: templateId,
    name,
    amount: encryption.encryptAmount(amount, dek),
    kind,
    recurrence,
    description: '',
    original_amount: null,
    original_currency: null,
    target_currency: null,
    exchange_rate: null,
  };
}

export function getStandardMonthLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    ...getStandardIncomeLines(templateId, encryption, dek),
    ...getStandardFixedExpenses(templateId, encryption, dek),
    ...getStandardVariableExpenses(templateId, encryption, dek),
    ...getStandardSavings(templateId, encryption, dek),
  ];
}

function getStandardIncomeLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Salaire net',
      6500,
      'income',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Freelance design',
      800,
      'income',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getStandardFixedExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(templateId, 'Loyer', 1850, 'expense', 'fixed', encryption, dek),
    createLine(templateId, 'Charges', 180, 'expense', 'fixed', encryption, dek),
    createLine(
      templateId,
      'Assurance maladie',
      385,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Abonnement mobile',
      69,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Internet & TV',
      89,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Abonnement CFF',
      185,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Assurance RC/Ménage',
      35,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Netflix & Spotify',
      38,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Salle de sport',
      99,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

function getStandardVariableExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Courses alimentaires',
      600,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Restaurants/Sorties',
      400,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Shopping vêtements',
      200,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Essence/Parking',
      150,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Pharmacie/Santé',
      80,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Coiffeur/Beauté',
      120,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Divers/Imprévus',
      150,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getStandardSavings(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Épargne logement',
      1000,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      '3ème pilier',
      580,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      "Fonds d'urgence",
      300,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

export function getVacationMonthLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    ...getVacationIncomeLines(templateId, encryption, dek),
    ...getVacationFixedExpenses(templateId, encryption, dek),
    ...getVacationSpecificExpenses(templateId, encryption, dek),
    ...getVacationSavings(templateId, encryption, dek),
  ];
}

function getVacationIncomeLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Salaire net',
      6500,
      'income',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      '13ème salaire',
      2500,
      'income',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getVacationFixedExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(templateId, 'Loyer', 1850, 'expense', 'fixed', encryption, dek),
    createLine(templateId, 'Charges', 180, 'expense', 'fixed', encryption, dek),
    createLine(
      templateId,
      'Assurance maladie',
      385,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Abonnements divers',
      281,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

function getVacationSpecificExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      "Billets d'avion",
      800,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Hôtel (7 nuits)',
      1200,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Budget vacances',
      1500,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Assurance voyage',
      85,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getVacationSavings(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      '3ème pilier',
      580,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

export function getSavingsMonthLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    ...getSavingsIncomeLines(templateId, encryption, dek),
    ...getSavingsMinimalExpenses(templateId, encryption, dek),
    ...getSavingsMaximized(templateId, encryption, dek),
  ];
}

function getSavingsIncomeLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Salaire net',
      6500,
      'income',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Vente Anibis',
      200,
      'income',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getSavingsMinimalExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(templateId, 'Loyer', 1850, 'expense', 'fixed', encryption, dek),
    createLine(templateId, 'Charges', 180, 'expense', 'fixed', encryption, dek),
    createLine(
      templateId,
      'Assurance maladie',
      385,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Abonnements essentiels',
      154,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Courses (budget serré)',
      400,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Transport',
      185,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Minimum vital',
      200,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getSavingsMaximized(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Épargne logement',
      1700,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      '3ème pilier',
      580,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Investissement ETF',
      400,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      "Fonds d'urgence",
      400,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

export function getHolidayMonthLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    ...getHolidayIncomeLines(templateId, encryption, dek),
    ...getHolidayFixedExpenses(templateId, encryption, dek),
    ...getHolidaySpecificExpenses(templateId, encryption, dek),
    ...getHolidaySavings(templateId, encryption, dek),
  ];
}

function getHolidayIncomeLines(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Salaire net',
      6500,
      'income',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      "Prime de fin d'année",
      3000,
      'income',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getHolidayFixedExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(templateId, 'Loyer', 1850, 'expense', 'fixed', encryption, dek),
    createLine(templateId, 'Charges', 180, 'expense', 'fixed', encryption, dek),
    createLine(
      templateId,
      'Assurances diverses',
      420,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Abonnements',
      281,
      'expense',
      'fixed',
      encryption,
      dek,
    ),
  ];
}

function getHolidaySpecificExpenses(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Cadeaux famille',
      800,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Cadeaux amis',
      400,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Repas de fêtes',
      600,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Décorations',
      150,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Sorties festives',
      500,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      'Tenue de soirée',
      350,
      'expense',
      'one_off',
      encryption,
      dek,
    ),
  ];
}

function getHolidaySavings(
  templateId: string,
  encryption: EncryptionPort,
  dek: Buffer,
): TemplateLine[] {
  return [
    createLine(
      templateId,
      'Épargne logement',
      1000,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
    createLine(
      templateId,
      '3ème pilier',
      580,
      'saving',
      'fixed',
      encryption,
      dek,
    ),
  ];
}
