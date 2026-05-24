'use client';

import { useState } from 'react';
import { QuizCard } from '@/components/quiz/QuizCard';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
}

interface QuizState {
  attemptId: string;
  questions: Question[];
  answers: Record<string, number>;
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    selectedOption: number;
    correctOption: number;
  }>;
  score: number;
  maxScore: number;
  passed: boolean;
}

type PageState = 'idle' | 'loading' | 'quiz' | 'submitting' | 'result' | 'error';

export default function QuizPage() {
  const [page, setPage] = useState<PageState>('idle');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const startQuiz = async () => {
    setPage('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/ccse/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 25 }),
      });
      if (!res.ok) throw new Error('No se pudo iniciar el simulacro');
      const data = (await res.json()) as { attemptId: string; questions: Question[] };
      setQuiz({
        attemptId: data.attemptId,
        questions: data.questions,
        answers: {},
        results: [],
        score: 0,
        maxScore: data.questions.length,
        passed: false,
      });
      setCurrentIndex(0);
      setPage('quiz');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      setPage('error');
    }
  };

  const selectAnswer = (option: number) => {
    if (!quiz) return;
    const questionId = quiz.questions[currentIndex]?.id;
    if (!questionId) return;
    setQuiz((prev) =>
      prev ? { ...prev, answers: { ...prev.answers, [questionId]: option } } : prev,
    );
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    setPage('submitting');
    const answers = Object.entries(quiz.answers).map(([questionId, selectedOption]) => ({
      questionId,
      selectedOption,
    }));
    try {
      const res = await fetch(`/api/ccse/attempts/${quiz.attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Error al enviar respuestas');
      const data = (await res.json()) as {
        score: number;
        maxScore: number;
        passed: boolean;
        results: Array<{
          questionId: string;
          isCorrect: boolean;
          selectedOption: number;
          correctOption: number;
        }>;
      };
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              results: data.results,
              score: data.score,
              maxScore: data.maxScore,
              passed: data.passed,
            }
          : prev,
      );
      setCurrentIndex(0);
      setPage('result');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      setPage('error');
    }
  };

  const currentQuestion = quiz?.questions[currentIndex];
  const currentAnswer = currentQuestion ? (quiz?.answers[currentQuestion.id] ?? null) : null;
  const currentResult = quiz?.results.find((r) => r.questionId === currentQuestion?.id);
  const answeredCount = Object.keys(quiz?.answers ?? {}).length;
  const totalQuestions = quiz?.questions.length ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulacro CCSE</h1>
        <p className="text-gray-500 text-sm mt-1">
          Examen de Conocimientos Constitucionales y Socioculturales de España
        </p>
      </div>

      {page === 'idle' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <p className="text-gray-600">
            El examen CCSE consta de <strong>25 preguntas</strong> de opción múltiple. Se aprueba
            con el <strong>60% de aciertos</strong> (15/25).
          </p>
          <button
            onClick={startQuiz}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Iniciar simulacro
          </button>
        </div>
      )}

      {(page === 'loading' || page === 'submitting') && (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      )}

      {page === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {errorMsg}
          <button onClick={() => setPage('idle')} className="ml-4 underline text-sm">
            Volver
          </button>
        </div>
      )}

      {page === 'quiz' && currentQuestion && (
        <div className="space-y-6">
          <QuizCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
            selectedOption={currentAnswer}
            onSelect={selectAnswer}
          />

          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>

            <span className="text-sm text-gray-500">
              {answeredCount}/{totalQuestions} respondidas
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={answeredCount < totalQuestions}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                Enviar respuestas
              </button>
            )}
          </div>
        </div>
      )}

      {page === 'result' && quiz && (
        <div className="space-y-6">
          <div
            className={`rounded-xl border p-6 text-center ${quiz.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
          >
            <p className="text-3xl font-bold mb-1">{quiz.passed ? '✅ APROBADO' : '❌ SUSPENSO'}</p>
            <p className="text-xl font-semibold">
              {quiz.score} / {quiz.maxScore} correctas
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ({Math.round((quiz.score / Math.max(quiz.maxScore, 1)) * 100)}% — mínimo 60%)
            </p>
          </div>

          <div className="space-y-4">
            {quiz.questions.map((q, idx) => {
              const result = quiz.results.find((r) => r.questionId === q.id);
              return (
                <QuizCard
                  key={q.id}
                  question={q}
                  questionNumber={idx + 1}
                  totalQuestions={quiz.questions.length}
                  selectedOption={result?.selectedOption ?? null}
                  onSelect={() => {}}
                  showResult
                  correctOption={result?.correctOption}
                />
              );
            })}
          </div>

          <button
            onClick={() => {
              setQuiz(null);
              setPage('idle');
            }}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Nuevo simulacro
          </button>
        </div>
      )}
    </div>
  );
}
