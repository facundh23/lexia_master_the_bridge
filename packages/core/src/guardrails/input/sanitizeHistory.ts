const MAX_HISTORY_TURNS = 6;
const MAX_TURN_LENGTH = 2000;

// Patrones que indican instrucciones del sistema embebidas en el historial
const SYSTEM_INJECTION_RE =
  /instruc(ción|ciones)\s+del\s+sistema|system\s+(prompt|instruction)|nuevo\s+rol|nueva\s+identidad|ignora\s+(tus\s+)?(instruc|reglas)|olvida\s+(tus\s+)?(instruc|reglas)|ahora\s+eres|a\s+partir\s+de\s+ahora\s+serás/i;

export function sanitizeHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history.slice(-MAX_HISTORY_TURNS).map((m) => {
    let content = m.content.slice(0, MAX_TURN_LENGTH);
    if (SYSTEM_INJECTION_RE.test(content)) {
      content = '[mensaje eliminado por política de seguridad]';
    }
    return { role: m.role, content };
  });
}
