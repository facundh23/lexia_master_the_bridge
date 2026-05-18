export interface EligibilityInput {
  countryOrigin?: string;
  arrivalDate?: string;
  residenceStatus?: string;
}

export interface EligibilityResult {
  yearsRequired: number;
  yearsElapsed?: number;
  yearsRemaining?: number;
  isEligible?: boolean;
  specialCase: 'general' | 'iberoamerican' | 'refugee' | 'other_special';
  legalBasis: string;
  notes: string[];
}

const TWO_YEAR_COUNTRIES = new Set([
  'argentina',
  'bolivia',
  'brasil',
  'brazil',
  'chile',
  'colombia',
  'costa rica',
  'cuba',
  'ecuador',
  'el salvador',
  'filipinas',
  'philippines',
  'guatemala',
  'guinea ecuatorial',
  'equatorial guinea',
  'honduras',
  'mexico',
  'méxico',
  'nicaragua',
  'panamá',
  'panama',
  'paraguay',
  'perú',
  'peru',
  'portugal',
  'república dominicana',
  'dominican republic',
  'uruguay',
  'venezuela',
  'andorra',
  'puerto rico',
]);

const FIVE_YEAR_STATUSES = new Set([
  'refugiado',
  'refugee',
  'apatridia',
  'apatrida',
  'stateless',
]);

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

export function computeEligibility(input: EligibilityInput): EligibilityResult {
  const country = (input.countryOrigin ?? '').toLowerCase().trim();
  const status = (input.residenceStatus ?? '').toLowerCase().trim();

  let yearsRequired = 10;
  let specialCase: EligibilityResult['specialCase'] = 'general';
  let legalBasis =
    'Art. 22.1 del Código Civil — residencia legal continuada: 10 años (regla general)';

  if (FIVE_YEAR_STATUSES.has(status)) {
    yearsRequired = 5;
    specialCase = 'refugee';
    legalBasis = 'Art. 22.1 CC — refugiados y apátridas reconocidos: 5 años';
  } else if (country && TWO_YEAR_COUNTRIES.has(country)) {
    yearsRequired = 2;
    specialCase = 'iberoamerican';
    legalBasis =
      'Art. 22.1 CC — nacionales de países iberoamericanos, Portugal, Andorra, Filipinas, Guinea Ecuatorial y Sefardíes: 2 años';
  }

  const notes: string[] = [
    'La residencia debe ser legal, continuada e inmediatamente anterior a la petición (Art. 22.3 CC).',
    'Se requiere buena conducta cívica y suficiente grado de integración en la sociedad española (Art. 22.4 CC).',
    'Ausencias superiores a 6 meses por año pueden interrumpir la continuidad del cómputo.',
  ];

  let yearsElapsed: number | undefined;
  let yearsRemaining: number | undefined;
  let isEligible: boolean | undefined;

  if (input.arrivalDate) {
    const arrival = new Date(input.arrivalDate);
    if (!isNaN(arrival.getTime())) {
      const now = new Date();
      const msElapsed = now.getTime() - arrival.getTime();
      yearsElapsed = Math.floor(msElapsed / MS_PER_YEAR);
      yearsRemaining = Math.max(0, yearsRequired - yearsElapsed);
      isEligible = yearsElapsed >= yearsRequired;
    }
  }

  return {
    yearsRequired,
    yearsElapsed,
    yearsRemaining,
    isEligible,
    specialCase,
    legalBasis,
    notes,
  };
}
