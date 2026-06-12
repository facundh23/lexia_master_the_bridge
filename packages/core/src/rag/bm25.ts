const K1 = 1.5;
const B = 0.75;

const SPANISH_STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un',
  'para', 'con', 'no', 'una', 'su', 'al', 'es', 'lo', 'como', 'mas', 'pero',
  'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha', 'si', 'porque', 'esta', 'son',
  'entre', 'cuando', 'muy', 'sin', 'sobre', 'ser', 'tiene', 'tambien', 'me',
  'hasta', 'hay', 'donde', 'que', 'ni', 'nos', 'mi', 'ese', 'cual', 'todo',
  'era', 'eso', 'desde', 'he', 'te', 'han', 'ante', 'sido', 'sea', 'mismo',
  'cada', 'otro', 'aqui', 'tres', 'dos', 'les', 'esa', 'estar',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !SPANISH_STOPWORDS.has(t));
}

export function extractKeyTerms(query: string, topN = 3): string[] {
  const tokens = tokenize(query);
  return [...new Set(tokens)].slice(0, topN);
}

export function bm25Score(query: string, documents: string[]): number[] {
  if (documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return documents.map(() => 0);

  const docTokens = documents.map(tokenize);
  const totalLen = docTokens.reduce((s, d) => s + d.length, 0);
  const avgdl = totalLen / documents.length || 1;
  const N = documents.length;

  return docTokens.map((docToks) => {
    const dl = docToks.length;
    const tf = new Map<string, number>();
    for (const t of docToks) tf.set(t, (tf.get(t) ?? 0) + 1);

    return queryTokens.reduce((score, term) => {
      const termTf = tf.get(term) ?? 0;
      if (termTf === 0) return score;
      const df = docTokens.filter((d) => d.includes(term)).length;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      const tfNorm = (termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * (dl / avgdl)));
      return score + idf * tfNorm;
    }, 0);
  });
}
