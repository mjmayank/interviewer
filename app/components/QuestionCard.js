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
    }
  }, [externalIsComplete, isComplete, primaryQuestion]);

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
        });
      }
    } else {
      // If API failed, mark as complete
      setIsComplete(true);
      if (onComplete) {
        onComplete(questionIndex);
      }
      if (onUpdate) {
        onUpdate(questionIndex, {
          pairs: updatedPairsWithAnswer,
          characterCount: newCharacterCount,
          isComplete: true,
        });
      }
    }

    setIsLoading(false);
  }, [currentAnswerInput, isLoading, activePair, activePairIndex, characterCount, pairs, buildConversationHistory, generateFollowUp, onComplete, onUpdate, questionIndex]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (isLoading || !activePair) return;

    setIsComplete(true);
    setIsLoading(false);
    if (onComplete) {
      onComplete(questionIndex);
    }
    if (onUpdate) {
      onUpdate(questionIndex, {
        pairs,
        characterCount,
        isComplete: true,
      });
    }
  }, [isLoading, activePair, onComplete, onUpdate, questionIndex, pairs, characterCount]);

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
    </div>
  );
}

