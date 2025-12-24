'use client';

import { useState, useEffect, useCallback } from 'react';
import QuestionAnswerPair from './QuestionAnswerPair';
import LoadingIndicator from './LoadingIndicator';

export default function QuestionCard({
  questionIndex,
  primaryQuestion,
  totalQuestions,
  userName,
  isComplete: externalIsComplete,
  onComplete,
  onUpdate,
}) {
  // Local state for this question card
  const [pairs, setPairs] = useState([
    { question: primaryQuestion, answer: null, id: 0 }
  ]);
  const [currentAnswerInput, setCurrentAnswerInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(externalIsComplete || false);
  const [characterCount, setCharacterCount] = useState(0);
  const [editableSummary, setEditableSummary] = useState('');
  const [userEditedSummary, setUserEditedSummary] = useState('');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  // Sync external completion state
  useEffect(() => {
    if (externalIsComplete && !isComplete) {
      setIsComplete(true);
    } else if (!externalIsComplete && isComplete) {
      // Reset if external state says not complete (e.g., on start over)
      setIsComplete(false);
      setPairs([{ question: primaryQuestion, answer: null, id: 0 }]);
      setCurrentAnswerInput('');
      setCharacterCount(0);
      setEditableSummary('');
      setUserEditedSummary('');
      setIsSummaryExpanded(false);
    }
  }, [externalIsComplete, isComplete, primaryQuestion]);

  // Auto-expand summary when question is complete
  useEffect(() => {
    if (isComplete && editableSummary) {
      setIsSummaryExpanded(true);
    }
  }, [isComplete, editableSummary]);

  // Helper function to join answers with proper punctuation
  const joinAnswersWithPunctuation = useCallback((answers, separator = ' ') => {
    if (answers.length === 0) return '';
    if (answers.length === 1) return answers[0];

    let result = answers[0];
    for (let i = 1; i < answers.length; i++) {
      const prevAnswer = result.trim();
      const currentAnswer = answers[i].trim();

      // Check if previous answer ends with sentence-ending punctuation
      const endsWithPunctuation = /[.!?]$/.test(prevAnswer);

      if (endsWithPunctuation) {
        result += separator + currentAnswer;
      } else {
        result += '.' + separator + currentAnswer;
      }
    }
    return result;
  }, []);

  // When question becomes complete, concatenate all answers
  useEffect(() => {
    if (isComplete && pairs.length > 0) {
      const answers = pairs
        .filter(pair => pair.answer)
        .map(pair => pair.answer);
      const allAnswers = joinAnswersWithPunctuation(answers, ' ');

      // Only set if editableSummary is empty (first time completing)
      // Use userEditedSummary if it exists, otherwise use concatenated answers
      if (!editableSummary) {
        setEditableSummary(userEditedSummary || allAnswers);
      }
    }
  }, [isComplete, pairs, editableSummary, userEditedSummary, joinAnswersWithPunctuation]);

  // Get the active pair (the last one without an answer)
  const activePairIndex = pairs.findIndex(p => p.answer === null);
  const activePair = activePairIndex !== -1 ? pairs[activePairIndex] : null;

  // Call Claude API to generate a follow-up question
  const generateFollowUp = useCallback(async (conversationHistory) => {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationHistory,
          isGeneratingArticle: false,
          userName,
          currentQuestionIndex: questionIndex,
          primaryQuestions: [primaryQuestion], // Pass as array for API compatibility
          followUpCount: pairs.length - 1, // Subtract 1 for primary question
          userCharacterCount: characterCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API request failed:', errorData);
        return null;
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Error calling Claude:', error);
      return null;
    }
  }, [userName, questionIndex, primaryQuestion, pairs.length, characterCount]);

  // Build conversation history for this question
  const buildConversationHistory = useCallback(() => {
    const history = [];
    for (const pair of pairs) {
      if (pair.question) {
        history.push({ role: 'assistant', content: pair.question });
      }
      if (pair.answer) {
        history.push({ role: 'user', content: pair.answer });
      }
    }
    return history;
  }, [pairs]);

  // Handle answer submission
  const handleSubmitAnswer = useCallback(async () => {
    if (!currentAnswerInput.trim() || isLoading || !activePair) return;

    const answer = currentAnswerInput.trim();
    const newCharacterCount = characterCount + answer.length;
    const followUpCount = pairs.length - 1; // Current pairs minus primary question

    // Check if we should mark as complete
    const shouldMarkComplete = followUpCount >= 2 || newCharacterCount >= 400;

    setIsLoading(true);

    // Build conversation history with the new answer included
    const conversationHistory = buildConversationHistory();
    conversationHistory.push({ role: 'user', content: answer });

    // Update the pair with the answer
    const updatedPairsWithAnswer = pairs.map((p, idx) =>
      idx === activePairIndex ? { ...p, answer } : p
    );

    setPairs(updatedPairsWithAnswer);
    setCharacterCount(newCharacterCount);
    setCurrentAnswerInput('');

    // Update editable summary as soon as there's at least one answer
    const answers = updatedPairsWithAnswer
      .filter(pair => pair.answer)
      .map(pair => pair.answer);
    const allAnswers = joinAnswersWithPunctuation(answers, ' ');

    // Only update editableSummary if it's empty or if user hasn't edited it
    if (!editableSummary || editableSummary === userEditedSummary || editableSummary === joinAnswersWithPunctuation(
      pairs.filter(pair => pair.answer).map(pair => pair.answer), ' '
    )) {
      setEditableSummary(allAnswers);
    }

    if (shouldMarkComplete) {
      setIsComplete(true);
      setIsLoading(false);
      if (onComplete) {
        onComplete(questionIndex);
      }

      if (onUpdate) {
        onUpdate(questionIndex, {
          pairs: updatedPairsWithAnswer,
          characterCount: newCharacterCount,
          isComplete: true,
          userEditedSummary: userEditedSummary || allAnswers,
        });
      }
      return;
    }

    // Generate follow-up question
    const followUpQuestion = await generateFollowUp(conversationHistory);

    if (followUpQuestion) {
      // Add new pair with follow-up question
      const finalPairs = [
        ...updatedPairsWithAnswer,
        { question: followUpQuestion, answer: null, id: updatedPairsWithAnswer.length }
      ];
      setPairs(finalPairs);

      if (onUpdate) {
        onUpdate(questionIndex, {
          pairs: finalPairs,
          characterCount: newCharacterCount,
          isComplete: false,
          userEditedSummary: userEditedSummary || allAnswers,
        });
      }
    } else {
      // If API failed, mark as complete
      setIsComplete(true);
      if (onComplete) {
        onComplete(questionIndex);
      }
      const initialSummary = userEditedSummary || allAnswers;
      if (!userEditedSummary) {
        setUserEditedSummary(allAnswers);
      }

      if (onUpdate) {
        onUpdate(questionIndex, {
          pairs: updatedPairsWithAnswer,
          characterCount: newCharacterCount,
          isComplete: true,
          userEditedSummary: initialSummary,
        });
      }
    }

    setIsLoading(false);
  }, [currentAnswerInput, isLoading, activePair, activePairIndex, characterCount, pairs, buildConversationHistory, generateFollowUp, onComplete, onUpdate, questionIndex, userEditedSummary, joinAnswersWithPunctuation]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (isLoading || !activePair) return;

    setIsComplete(true);
    setIsLoading(false);
    if (onComplete) {
      onComplete(questionIndex);
    }
    // Concatenate all answers for editable summary
    const answers = pairs
      .filter(pair => pair.answer)
      .map(pair => pair.answer);
    const allAnswers = joinAnswersWithPunctuation(answers, ' ');
    const initialSummary = userEditedSummary || allAnswers;
    // Only update if editableSummary is empty or matches previous state
    if (!editableSummary || editableSummary === userEditedSummary || editableSummary === joinAnswersWithPunctuation(
      pairs.filter(pair => pair.answer).map(pair => pair.answer), ' '
    )) {
      setEditableSummary(allAnswers);
    }
    if (!userEditedSummary) {
      setUserEditedSummary(allAnswers);
    }

    if (onUpdate) {
      onUpdate(questionIndex, {
        pairs,
        characterCount,
        isComplete: true,
        userEditedSummary: initialSummary,
      });
    }
  }, [isLoading, activePair, onComplete, onUpdate, questionIndex, pairs, characterCount, userEditedSummary, editableSummary, joinAnswersWithPunctuation]);

  // Handle key press
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  }, [handleSubmitAnswer]);

  // Handle answer input change
  const handleAnswerChange = useCallback((e) => {
    setCurrentAnswerInput(e.target.value);
  }, []);

  // Handle editable summary change - auto-update as user types
  const handleEditableSummaryChange = useCallback((e) => {
    const newValue = e.target.value;
    setEditableSummary(newValue);
    setUserEditedSummary(newValue);
    // Update parent component immediately
    if (onUpdate) {
      onUpdate(questionIndex, {
        pairs,
        characterCount,
        isComplete: isComplete,
        userEditedSummary: newValue,
      });
    }
  }, [onUpdate, questionIndex, pairs, characterCount, isComplete]);

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-6 ${
        isComplete ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm font-semibold text-blue-600">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        {isComplete && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
            Complete
          </span>
        )}
      </div>

      {/* Show all Q&A pairs */}
      {pairs.map((pair, idx) => (
        <QuestionAnswerPair
          key={pair.id}
          question={pair.question}
          answer={pair.answer}
          answerInput={idx === activePairIndex ? currentAnswerInput : ''}
          isLoading={isLoading && idx === activePairIndex}
          isActive={idx === activePairIndex && !isComplete}
          onAnswerChange={handleAnswerChange}
          onSubmitAnswer={handleSubmitAnswer}
          onSkip={handleSkip}
          onKeyPress={handleKeyPress}
        />
      ))}

      {/* Show loading indicator when generating follow-up */}
      {isLoading && !isComplete && (
        <div className="mt-2">
          <LoadingIndicator message="Generating follow-up question..." />
        </div>
      )}

      {/* Editable Summary Box - shown as soon as first answer is submitted */}
      {editableSummary && (
        <div className="mt-6 pt-6 border-t border-gray-300">
          <button
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="w-full flex items-center justify-between text-left mb-3 hover:bg-gray-50 -mx-2 px-2 py-2 rounded transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">Your Summary (Editable):</p>
              {!isSummaryExpanded && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {editableSummary.substring(0, 100)}{editableSummary.length > 100 ? '...' : ''}
                </p>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${isSummaryExpanded ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isSummaryExpanded && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Review and edit your combined responses below. Changes are saved automatically as you type.
              </p>
              <textarea
                value={editableSummary}
                onChange={handleEditableSummaryChange}
                placeholder="Your combined responses will appear here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[150px]"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

