export function redactPII(text: string): string {
  const EMAIL_RE = /\b[\w.+\-]+@[\w\-]+\.[\w.]+\b/gi;
  const IBAN_RE = /\b[A-Z]{2}[0-9]{2}[\s\-]?([0-9]{4}[\s\-]?){4,6}\b/g;
  const DNI_RE = /\b[0-9]{8}[A-Za-z]\b/gi;
  const NIE_RE = /\b[XYZ][\-]?[0-9]{7}[\-]?[A-Za-z]\b/gi;
  const PASSPORT_RE = /\b[A-Z]{3}[0-9]{6}\b/g;
  const CARD_RE = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;
  const PHONE_ES_RE =
    /(?<!\d)(?:\+34|0034)?[\s\-]?[6-9][0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{3}(?!\d)/g;

  return text
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(IBAN_RE, '[IBAN]')
    .replace(DNI_RE, '[DNI]')
    .replace(NIE_RE, '[NIE]')
    .replace(PASSPORT_RE, '[PASAPORTE]')
    .replace(CARD_RE, '[TARJETA]')
    .replace(PHONE_ES_RE, '[TELÉFONO]');
}

export function detectPII(text: string): boolean {
  const EMAIL_RE = /\b[\w.+\-]+@[\w\-]+\.[\w.]+\b/gi;
  const DNI_RE = /\b[0-9]{8}[A-Za-z]\b/gi;
  const NIE_RE = /\b[XYZ][\-]?[0-9]{7}[\-]?[A-Za-z]\b/gi;
  const IBAN_RE = /\b[A-Z]{2}[0-9]{2}[\s\-]?([0-9]{4}[\s\-]?){4,6}\b/g;
  const PHONE_ES_RE =
    /(?<!\d)(?:\+34|0034)?[\s\-]?[6-9][0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{3}(?!\d)/g;
  const PASSPORT_RE = /\b[A-Z]{3}[0-9]{6}\b/g;
  const CARD_RE = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;

  return [EMAIL_RE, DNI_RE, NIE_RE, IBAN_RE, PHONE_ES_RE, PASSPORT_RE, CARD_RE].some((re) =>
    re.test(text),
  );
}
