import type { DemoTemplateLineSeed } from '../../domain/demo.entity';

type LineSpec = Omit<DemoTemplateLineSeed, 'templateId'>;

function line(
  name: string,
  amount: number,
  kind: 'income' | 'expense' | 'saving',
  recurrence: 'fixed' | 'one_off',
): LineSpec {
  return { name, amount, kind, recurrence, description: '' };
}

const STANDARD_INCOME: LineSpec[] = [
  line('Salaire net', 6500, 'income', 'fixed'),
  line('Freelance design', 800, 'income', 'one_off'),
];

const STANDARD_FIXED_EXPENSES: LineSpec[] = [
  line('Loyer', 1850, 'expense', 'fixed'),
  line('Charges', 180, 'expense', 'fixed'),
  line('Assurance maladie', 385, 'expense', 'fixed'),
  line('Abonnement mobile', 69, 'expense', 'fixed'),
  line('Internet & TV', 89, 'expense', 'fixed'),
  line('Abonnement CFF', 185, 'expense', 'fixed'),
  line('Assurance RC/Ménage', 35, 'expense', 'fixed'),
  line('Netflix & Spotify', 38, 'expense', 'fixed'),
  line('Salle de sport', 99, 'expense', 'fixed'),
];

const STANDARD_VARIABLE_EXPENSES: LineSpec[] = [
  line('Courses alimentaires', 600, 'expense', 'one_off'),
  line('Restaurants/Sorties', 400, 'expense', 'one_off'),
  line('Shopping vêtements', 200, 'expense', 'one_off'),
  line('Essence/Parking', 150, 'expense', 'one_off'),
  line('Pharmacie/Santé', 80, 'expense', 'one_off'),
  line('Coiffeur/Beauté', 120, 'expense', 'one_off'),
  line('Divers/Imprévus', 150, 'expense', 'one_off'),
];

const STANDARD_SAVINGS: LineSpec[] = [
  line('Épargne logement', 1000, 'saving', 'fixed'),
  line('3ème pilier', 580, 'saving', 'fixed'),
  line("Fonds d'urgence", 300, 'saving', 'fixed'),
];

const VACATION_INCOME: LineSpec[] = [
  line('Salaire net', 6500, 'income', 'fixed'),
  line('13ème salaire', 2500, 'income', 'one_off'),
];

const VACATION_FIXED_EXPENSES: LineSpec[] = [
  line('Loyer', 1850, 'expense', 'fixed'),
  line('Charges', 180, 'expense', 'fixed'),
  line('Assurance maladie', 385, 'expense', 'fixed'),
  line('Abonnements divers', 281, 'expense', 'fixed'),
];

const VACATION_SPECIFIC_EXPENSES: LineSpec[] = [
  line("Billets d'avion", 800, 'expense', 'one_off'),
  line('Hôtel (7 nuits)', 1200, 'expense', 'one_off'),
  line('Budget vacances', 1500, 'expense', 'one_off'),
  line('Assurance voyage', 85, 'expense', 'one_off'),
];

const VACATION_SAVINGS: LineSpec[] = [
  line('3ème pilier', 580, 'saving', 'fixed'),
];

const SAVINGS_INCOME: LineSpec[] = [
  line('Salaire net', 6500, 'income', 'fixed'),
  line('Vente Anibis', 200, 'income', 'one_off'),
];

const SAVINGS_MINIMAL_EXPENSES: LineSpec[] = [
  line('Loyer', 1850, 'expense', 'fixed'),
  line('Charges', 180, 'expense', 'fixed'),
  line('Assurance maladie', 385, 'expense', 'fixed'),
  line('Abonnements essentiels', 154, 'expense', 'fixed'),
  line('Courses (budget serré)', 400, 'expense', 'one_off'),
  line('Transport', 185, 'expense', 'fixed'),
  line('Minimum vital', 200, 'expense', 'one_off'),
];

const SAVINGS_MAXIMIZED: LineSpec[] = [
  line('Épargne logement', 1700, 'saving', 'fixed'),
  line('3ème pilier', 580, 'saving', 'fixed'),
  line('Investissement ETF', 400, 'saving', 'fixed'),
  line("Fonds d'urgence", 400, 'saving', 'fixed'),
];

const HOLIDAY_INCOME: LineSpec[] = [
  line('Salaire net', 6500, 'income', 'fixed'),
  line("Prime de fin d'année", 3000, 'income', 'one_off'),
];

const HOLIDAY_FIXED_EXPENSES: LineSpec[] = [
  line('Loyer', 1850, 'expense', 'fixed'),
  line('Charges', 180, 'expense', 'fixed'),
  line('Assurances diverses', 420, 'expense', 'fixed'),
  line('Abonnements', 281, 'expense', 'fixed'),
];

const HOLIDAY_SPECIFIC_EXPENSES: LineSpec[] = [
  line('Cadeaux famille', 800, 'expense', 'one_off'),
  line('Cadeaux amis', 400, 'expense', 'one_off'),
  line('Repas de fêtes', 600, 'expense', 'one_off'),
  line('Décorations', 150, 'expense', 'one_off'),
  line('Sorties festives', 500, 'expense', 'one_off'),
  line('Tenue de soirée', 350, 'expense', 'one_off'),
];

const HOLIDAY_SAVINGS: LineSpec[] = [
  line('Épargne logement', 1000, 'saving', 'fixed'),
  line('3ème pilier', 580, 'saving', 'fixed'),
];

function buildLines(
  templateId: string,
  specs: LineSpec[],
): DemoTemplateLineSeed[] {
  return specs.map((spec) => ({ ...spec, templateId }));
}

export function getStandardMonthLines(
  templateId: string,
): DemoTemplateLineSeed[] {
  return buildLines(templateId, [
    ...STANDARD_INCOME,
    ...STANDARD_FIXED_EXPENSES,
    ...STANDARD_VARIABLE_EXPENSES,
    ...STANDARD_SAVINGS,
  ]);
}

export function getVacationMonthLines(
  templateId: string,
): DemoTemplateLineSeed[] {
  return buildLines(templateId, [
    ...VACATION_INCOME,
    ...VACATION_FIXED_EXPENSES,
    ...VACATION_SPECIFIC_EXPENSES,
    ...VACATION_SAVINGS,
  ]);
}

export function getSavingsMonthLines(
  templateId: string,
): DemoTemplateLineSeed[] {
  return buildLines(templateId, [
    ...SAVINGS_INCOME,
    ...SAVINGS_MINIMAL_EXPENSES,
    ...SAVINGS_MAXIMIZED,
  ]);
}

export function getHolidayMonthLines(
  templateId: string,
): DemoTemplateLineSeed[] {
  return buildLines(templateId, [
    ...HOLIDAY_INCOME,
    ...HOLIDAY_FIXED_EXPENSES,
    ...HOLIDAY_SPECIFIC_EXPENSES,
    ...HOLIDAY_SAVINGS,
  ]);
}
