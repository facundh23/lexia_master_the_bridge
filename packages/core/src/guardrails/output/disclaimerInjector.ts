export const DISCLAIMER =
  '\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado. Para casos complejos o decisiones formales, consultá un profesional.*';

export function injectDisclaimer(text: string): string {
  if (text.includes('NO sustituye')) return text;
  return text + DISCLAIMER;
}
