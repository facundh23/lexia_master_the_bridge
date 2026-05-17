import type { CorpusChunk } from '../../../rag/types.js';
import { hashChunk } from '../../../rag/chunk.js';

const VERTICAL = 'nacionalidad_residencia';

const rawChunks: Omit<CorpusChunk, 'id' | 'chunkHash'>[] = [
  {
    text: 'Artículo 22 del Código Civil. Son españoles de origen los nacidos de padre o madre española. También lo son los nacidos en España de padres extranjeros si, al menos, uno de ellos hubiera nacido también en España, salvo los hijos de funcionario diplomático o consular acreditado en España.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 0,
    publishedDate: '1889-07-25',
  },
  {
    text: 'Artículo 22 del Código Civil — Párrafo 1. Para la concesión de la nacionalidad por residencia se requiere que ésta haya durado diez años. Serán suficientes cinco años para los que hayan obtenido la condición de refugiado y dos años cuando se trate de nacionales de origen de países iberoamericanos, Andorra, Filipinas, Guinea Ecuatorial o Portugal, o de sefardíes.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 1,
    publishedDate: '1889-07-25',
  },
  {
    text: 'Artículo 22 del Código Civil — Párrafo 2. Bastará el tiempo de residencia de un año para el que lleve casado con español o española y no esté separado legalmente o de hecho, y para el viudo o viuda de española o español si a la muerte del cónyuge no estaba separado legalmente o de hecho. Para el nacido fuera de España de padre o madre, abuelo o abuela, que originariamente hubieran sido españoles.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 2,
    publishedDate: '1889-07-25',
  },
  {
    text: 'Artículo 22 del Código Civil — Párrafo 3. La residencia habrá de ser legal, continuada e inmediatamente anterior a la petición. El interesado deberá justificar, en las condiciones que reglamentariamente se establezcan, buena conducta cívica y suficiente grado de integración en la sociedad española.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 3,
    publishedDate: '1889-07-25',
  },
  {
    text: 'Artículo 23 del Código Civil. Son condiciones para la validez de la adquisición de la nacionalidad española por opción, carta de naturaleza o residencia: a) Que el mayor de catorce años y capaz para prestar una declaración por sí jure o prometa fidelidad al Rey y obediencia a la Constitución y a las leyes. b) Que la misma persona declare que renuncia a su anterior nacionalidad. Quedan a salvo de este requisito los naturales de países mencionados en el párrafo 1 del artículo 24 y los sefardíes originarios de España.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 4,
    publishedDate: '1889-07-25',
  },
  {
    text: 'Requisitos para la solicitud de nacionalidad por residencia (RD 557/2011, Art. 220 y ss.). El solicitante debe acreditar: 1) Residencia legal y continuada en España durante el período requerido. 2) Conocimiento del idioma español (certificado DELE A2 o equivalente, salvo nacionales de países hispanohablantes). 3) Conocimiento de la cultura y sociedad españolas (superación del examen CCSE del Instituto Cervantes). 4) Buena conducta cívica (ausencia de antecedentes penales en España y países de residencia anterior). 5) Integración en la sociedad española.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'BOE',
    sourceUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2011-7703',
    chunkIdx: 5,
    publishedDate: '2011-04-30',
  },
  {
    text: 'Examen CCSE — Conocimientos Constitucionales y Socioculturales de España. El CCSE es el examen que administra el Instituto Cervantes para acreditar el conocimiento de la Constitución española y la sociedad española. Consta de 25 preguntas tipo test de las cuales se deben responder correctamente al menos 15 (60%). Las preguntas cubren: historia de España, instituciones, organización territorial, cultura, geografía y costumbres. El examen tiene una duración de 30 minutos. El certificado CCSE tiene validez indefinida.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'manual_ccse',
    sourceUrl: 'https://examenes.cervantes.es/es/ccse/que-es',
    chunkIdx: 6,
    publishedDate: '2015-01-01',
  },
  {
    text: 'Procedimiento de solicitud de nacionalidad por residencia. La solicitud se presenta ante el Registro Civil del domicilio del solicitante o, si está en el extranjero, ante el Consulado español. Documentación mínima requerida: formulario oficial, DNI/pasaporte en vigor, certificado de empadronamiento actualizado, certificado de antecedentes penales del país de origen (apostillado), título de residencia en vigor, justificante del pago de la tasa, certificado CCSE y DELE (si procede). El plazo de resolución administrativo es de 1 año (art. 94 Ley 30/1992), pero en la práctica puede superar los 2-3 años.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'instruccion_dgrn',
    sourceUrl: 'https://www.mjusticia.gob.es/es/ciudadanos/tramites/nacionalidad-residencia',
    chunkIdx: 7,
    publishedDate: '2023-01-01',
  },
  {
    text: 'Hijos menores en la solicitud de nacionalidad por residencia. Los hijos menores de edad del solicitante pueden adquirir la nacionalidad española simultáneamente con el progenitor si están incluidos en la solicitud. Es IMPRESCINDIBLE incluirlos ANTES de la jura, al momento de presentar la documentación. Si no se incluyen antes de la jura, puede rechazarse la solicitud o requerirse un procedimiento separado posterior. El trámite es conjunto y debe realizarse antes del acto de jura ante el Registro Civil.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'instruccion_dgrn',
    sourceUrl: 'https://www.mjusticia.gob.es/es/ciudadanos/tramites/nacionalidad-residencia',
    chunkIdx: 8,
    publishedDate: '2023-01-01',
  },
  {
    text: 'Doble nacionalidad y renuncia. Los nacionales de países iberoamericanos, Andorra, Filipinas, Guinea Ecuatorial, Portugal y los sefardíes pueden adquirir la nacionalidad española sin renunciar a su nacionalidad anterior, al amparo de los tratados de doble nacionalidad vigentes con España. Para el resto de los solicitantes, la ley española exige la renuncia expresa a la nacionalidad anterior en el acto de la jura (Art. 23.b del Código Civil). Esta renuncia es voluntaria en derecho español, pero el país de origen puede no reconocerla.',
    vertical: VERTICAL,
    visibility: 'public',
    sourceType: 'codigo_civil',
    sourceUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763',
    chunkIdx: 9,
    publishedDate: '1889-07-25',
  },
];

export const SEED_CHUNKS: CorpusChunk[] = rawChunks.map((chunk) => ({
  ...chunk,
  id: `vertical:nacionalidad_residencia:chunk-${chunk.chunkIdx}`,
  chunkHash: hashChunk(chunk.text),
}));
