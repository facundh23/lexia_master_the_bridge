import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { generateCcseQuiz, evaluateCcseAnswers } from './agent.js';

export function createGenerateCcseQuizTool(userId: string) {
  return tool(
    async ({ size }: { size?: number }) => {
      const result = await generateCcseQuiz(userId, size ?? 25);
      if (!result.attemptId) return 'No se pudo generar el simulacro. Intenta de nuevo más tarde.';
      return JSON.stringify({
        attemptId: result.attemptId,
        questions: result.questions,
        instructions: `Tienes ${result.questions.length} preguntas. Cada pregunta tiene 4 opciones (0, 1, 2, 3). Responde con el índice de la opción correcta.`,
      });
    },
    {
      name: 'generate_ccse_quiz',
      description:
        'Genera un simulacro del examen CCSE con preguntas aleatorias. Devuelve las preguntas y un attemptId necesario para evaluar las respuestas.',
      schema: z.object({
        size: z
          .number()
          .optional()
          .describe('Número de preguntas (por defecto 25, igual que el examen real).'),
      }),
    },
  );
}

export function createEvaluateCcseAnswerTool() {
  return tool(
    async ({
      attemptId,
      answers,
    }: {
      attemptId: string;
      answers: Array<{ questionId: string; selectedOption: number }>;
    }) => {
      const result = await evaluateCcseAnswers(attemptId, answers);
      const passMark = result.passed ? '✅ APROBADO' : '❌ SUSPENSO';
      return JSON.stringify({
        ...result,
        summary: `${passMark} — ${result.score}/${result.maxScore} correctas (${Math.round((result.score / Math.max(result.maxScore, 1)) * 100)}%)`,
      });
    },
    {
      name: 'evaluate_ccse_answer',
      description:
        'Evalúa las respuestas de un simulacro CCSE. Requiere el attemptId y las respuestas del usuario. Devuelve puntuación y resultado por pregunta.',
      schema: z.object({
        attemptId: z.string().describe('ID del intento de generate_ccse_quiz'),
        answers: z
          .array(
            z.object({
              questionId: z.string(),
              selectedOption: z.number().min(0).max(3),
            }),
          )
          .describe('Array con las respuestas del usuario'),
      }),
    },
  );
}
