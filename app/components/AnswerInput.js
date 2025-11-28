'use client';

import { ArrowRight } from 'lucide-react';

export default function AnswerInput({
  questionIndex,
  answerInput,
  isLoading,
  isFollowUp,
  showLabel = true,
  onAnswerChange,
  onSubmitAnswer,
  onSkip,
  onKeyPress,
}) {
  return (
    <div className="space-y-3 mt-4">
      {showLabel && (
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-700 mb-1">
            {isFollowUp ? 'Follow-up Answer:' : 'Your Answer:'}
          </p>
        </div>
      )}
      <textarea
        value={answerInput || ''}
        onChange={(e) => onAnswerChange(questionIndex, e.target.value)}
        onKeyDown={(e) => onKeyPress(e, questionIndex)}
        placeholder="Type your answer here... (Press Cmd/Ctrl + Enter to submit)"
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px]"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Press Cmd/Ctrl + Enter to submit, or click the button below
        </p>
        <div className="flex space-x-2">
          <button
            onClick={() => onSkip(questionIndex)}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
          >
            <span>Skip</span>
          </button>
          <button
            onClick={() => onSubmitAnswer(questionIndex)}
            disabled={isLoading || !answerInput?.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <span>Submit</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

