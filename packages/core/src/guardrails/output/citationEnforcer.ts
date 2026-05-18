const CITATION_PATTERNS = [
  /\[BOE[^\]]*\]/i,
  /Art[íi]culo\s+\d+/i,
  /\bArt\.\s*\d+/i,
  /\bRD\s+\d+\/\d+/i,
  /\bLey\s+\d+\/\d+/i,
  /Código\s+Civil/i,
  /instrucción\s+DGRN/i,
  /\[DGRN[^\]]*\]/i,
  /\[CC[^\]]*\]/i,
];

export interface CitationCheckResult {
  hasCitations: boolean;
  citations: string[];
}

export function checkForCitations(text: string): CitationCheckResult {
  const citations: string[] = [];

  for (const pattern of CITATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      citations.push(...matches);
    }
  }

  return {
    hasCitations: citations.length > 0,
    citations: [...new Set(citations)],
  };
}
