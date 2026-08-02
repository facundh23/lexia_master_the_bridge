#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  runNormativaAgent,
  retrieveWithACL,
  createChromaClient,
  createEmbeddingClient,
  runFaithfulnessJudge,
  runAnswerRelevanceJudge,
  runContextRecallJudge,
  NORMATIVA_SYSTEM_PROMPT,
} from '@lexia/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatasetEntry {
  question: string;
  ground_truth: string;
}

interface RagasResult {
  question: string;
  ground_truth: string;
  answer: string;
  contexts: string[];
  faithfulness: number;
  answerRelevance: number;
  contextRecall: number;
  faithfulnessRationale: string;
  answerRelevanceRationale: string;
  contextRecallRationale: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dataset: DatasetEntry[] = JSON.parse(
    readFileSync('./packages/core/src/eval/ragas/dataset.json', 'utf8'),
  );

  console.log(`\n📊 RAGAS Eval — ${dataset.length} preguntas\n`);

  const chroma = createChromaClient();
  const embeddings = createEmbeddingClient();
  const VERTICAL = 'nacionalidad_residencia';
  const USER_ID = 'ragas-eval-runner';

  const results: RagasResult[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const entry = dataset[i]!;
    process.stdout.write(`  [${i + 1}/${dataset.length}] ${entry.question.slice(0, 60)}...\n`);

    let contexts: string[] = [];
    try {
      const chunks = await retrieveWithACL(chroma, embeddings, entry.question, {
        userId: USER_ID,
        vertical: VERTICAL,
        nResults: 6,
      });
      contexts = chunks.map((c) => c.chunk.text);
    } catch (err) {
      console.warn(`    ⚠️  RAG falló: ${err}`);
    }

    let answer = '';
    try {
      const agentResult = await runNormativaAgent({
        content: entry.question,
        conversationHistory: [],
        userId: USER_ID,
        vertical: VERTICAL,
      });
      answer = agentResult.response;
    } catch (err) {
      answer = `[ERROR: ${err}]`;
      console.warn(`    ⚠️  Agente falló: ${err}`);
    }

    const [faithfulness, answerRelevance, contextRecall] = await Promise.all([
      runFaithfulnessJudge({ response: answer, contexts, systemPrompt: NORMATIVA_SYSTEM_PROMPT }),
      runAnswerRelevanceJudge({ question: entry.question, response: answer }),
      runContextRecallJudge({ groundTruth: entry.ground_truth, contexts }),
    ]);

    results.push({
      question: entry.question,
      ground_truth: entry.ground_truth,
      answer,
      contexts,
      faithfulness: faithfulness.score,
      answerRelevance: answerRelevance.score,
      contextRecall: contextRecall.score,
      faithfulnessRationale: faithfulness.rationale,
      answerRelevanceRationale: answerRelevance.rationale,
      contextRecallRationale: contextRecall.rationale,
    });
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const metrics = {
    faithfulness: avg(results.map((r) => r.faithfulness)),
    answerRelevance: avg(results.map((r) => r.answerRelevance)),
    contextRecall: avg(results.map((r) => r.contextRecall)),
  };

  console.log('\n──────────────────────────────────────────────');
  console.log('  RESULTADOS RAGAS');
  console.log('──────────────────────────────────────────────');
  console.log(`  Faithfulness      ${(metrics.faithfulness * 100).toFixed(1)}%  (¿el modelo inventó algo?)`);
  console.log(`  Answer Relevance  ${(metrics.answerRelevance * 100).toFixed(1)}%  (¿respondió lo que se preguntó?)`);
  console.log(`  Context Recall    ${(metrics.contextRecall * 100).toFixed(1)}%  (¿el RAG recuperó bien?)`);
  console.log('──────────────────────────────────────────────\n');

  console.log('  Detalle por pregunta:');
  for (const r of results) {
    const f = (r.faithfulness * 100).toFixed(0).padStart(3);
    const a = (r.answerRelevance * 100).toFixed(0).padStart(3);
    const c = (r.contextRecall * 100).toFixed(0).padStart(3);
    console.log(`  F:${f}% AR:${a}% CR:${c}%  "${r.question.slice(0, 55)}"`);
  }

  mkdirSync('./artifacts', { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const outputPath = `./artifacts/ragas-report-${date}.json`;
  writeFileSync(outputPath, JSON.stringify({ metrics, results }, null, 2));
  console.log(`\n💾 Reporte guardado en: ${outputPath}\n`);
}

main().catch(console.error);
