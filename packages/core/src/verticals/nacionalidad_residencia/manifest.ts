import type { VerticalDefinition } from '../../vertical/definition.js';

export const nacionalidadResidencia: VerticalDefinition = {
  slug: 'nacionalidad_residencia',
  name: 'Nacionalidad por Residencia',
  description:
    'Asistencia informativa sobre el proceso de obtención de la nacionalidad española por residencia, incluyendo requisitos, plazos, documentación y examen CCSE.',
  enabled: true,
  version: '0.2.0',
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
  reminders: [
    {
      slug: 'children_before_oath',
      label: 'Incluir hijos antes de la jura',
      description:
        'Los hijos menores de 14 años pueden adquirir la nacionalidad junto con el progenitor. Deben incluirse antes de la jura, al presentar la documentación.',
      defaultDaysBeforeDeadline: 30,
    },
    {
      slug: 'gather_documents',
      label: 'Reunir documentación completa',
      description:
        'Reúne toda la documentación necesaria: certificado de nacimiento, antecedentes penales (país de origen y España), empadronamiento, certificado de integración.',
      defaultDaysBeforeDeadline: 60,
    },
    {
      slug: 'schedule_ccse_exam',
      label: 'Reservar plaza para el examen CCSE',
      description:
        'El examen CCSE se realiza en centros del Instituto Cervantes. Reserva plaza con antelación suficiente, ya que las plazas se agotan rápidamente.',
      defaultDaysBeforeDeadline: 90,
    },
    {
      slug: 'book_registry_appointment',
      label: 'Pedir cita en el Registro Civil',
      description:
        'Solicita cita previa en el Registro Civil de tu localidad para presentar la solicitud de nacionalidad. Los tiempos de espera pueden ser largos.',
      defaultDaysBeforeDeadline: 14,
    },
  ],
};
