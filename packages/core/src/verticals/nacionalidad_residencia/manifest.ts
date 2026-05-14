import type { VerticalDefinition } from '../../vertical/definition.js';

export const nacionalidadResidencia: VerticalDefinition = {
  slug: 'nacionalidad_residencia',
  name: 'Nacionalidad por Residencia',
  description:
    'Asistencia informativa sobre el proceso de obtención de la nacionalidad española por residencia, incluyendo requisitos, plazos, documentación y examen CCSE.',
  enabled: true,
  version: '0.1.0',
  corpus: {
    namespace: 'vertical:nacionalidad_residencia',
    sources: [
      'BOE (RD 557/2011 - Reglamento de Extranjería)',
      'Código Civil arts. 17-26 (nacionalidad)',
      'Instrucciones DGRN sobre nacionalidad por residencia',
      'Manual oficial CCSE (Instituto Cervantes)',
    ],
  },
  intake: {
    fields: ['countryOrigin', 'arrivalDate', 'residenceStatus', 'hasChildren'],
  },
};
