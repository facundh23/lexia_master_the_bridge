'use client';

interface QuizCardProps {
  question: {
    id: string;
    questionText: string;
    options: string[];
    category: string;
  };
  questionNumber: number;
  totalQuestions: number;
  selectedOption: number | null;
  onSelect: (option: number) => void;
  showResult?: boolean;
  correctOption?: number;
}

export function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOption,
  onSelect,
  showResult = false,
  correctOption,
}: QuizCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="font-medium text-blue-600 capitalize">{question.category}</span>
        <span>
          {questionNumber} / {totalQuestions}
        </span>
      </div>

      <p className="text-gray-900 font-medium text-lg leading-relaxed">{question.questionText}</p>

      <ul className="space-y-2">
        {question.options.map((option, index) => {
          let className =
            'w-full text-left px-4 py-3 rounded-lg border transition-colors ';

          if (showResult && correctOption !== undefined) {
            if (index === correctOption) {
              className += 'bg-green-50 border-green-400 text-green-800';
            } else if (index === selectedOption && index !== correctOption) {
              className += 'bg-red-50 border-red-400 text-red-800';
            } else {
              className += 'bg-gray-50 border-gray-200 text-gray-500';
            }
          } else if (selectedOption === index) {
            className += 'bg-blue-50 border-blue-400 text-blue-800';
          } else {
            className +=
              'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer';
          }

          return (
            <li key={index}>
              <button
                type="button"
                className={className}
                onClick={() => !showResult && onSelect(index)}
                disabled={showResult}
              >
                <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
