'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInterview } from '../hooks/useInterview';
import QuestionCard from '../components/QuestionCard';
import ArticleDisplay from '../components/ArticleDisplay';

export default function SurveyPage() {
  const [questionStates, setQuestionStates] = useState({});
  const [completedQuestions, setCompletedQuestions] = useState(new Set());
  const [questionHistories, setQuestionHistories] = useState([]);
  const [userEditedSummaries, setUserEditedSummaries] = useState({});

  const {
    userName,
    setUserName,
    isLoading,
    interviewComplete,
    article,
    emailSent,
    isSendingEmail,
    handleStartOver,
    handleSendEmail,
    primaryQuestions,
    generateArticle,
    questionSummaries,
    questionLoadingStates,
  } = useInterview();

  // Track when a question is completed
  const handleQuestionComplete = useCallback((questionIndex) => {
    setCompletedQuestions(prev => new Set([...prev, questionIndex]));
  }, []);

  // Track question state updates
  const handleQuestionUpdate = useCallback((questionIndex, state) => {
    setQuestionStates(prev => ({
      ...prev,
      [questionIndex]: state,
    }));
    // Track user-edited summaries
    if (state.userEditedSummary) {
      setUserEditedSummaries(prev => ({
        ...prev,
        [questionIndex]: state.userEditedSummary,
      }));
    }
  }, []);

  // Check if all questions are complete and generate article
  useEffect(() => {
    if (primaryQuestions.length === 0 || interviewComplete) return;

    const allComplete = primaryQuestions.every((_, idx) =>
      completedQuestions.has(idx)
    );

    if (allComplete && primaryQuestions.length > 0) {
      // Build conversation history for each question individually
      const histories = [];
      for (let i = 0; i < primaryQuestions.length; i++) {
        const state = questionStates[i];
        const history = [];
        if (state?.pairs) {
          for (const pair of state.pairs) {
            if (pair.question) {
              history.push({ role: 'assistant', content: pair.question });
            }
            if (pair.answer) {
              history.push({ role: 'user', content: pair.answer });
            }
          }
        }
        if (history.length > 0) {
          histories.push({
            questionIndex: i,
            conversationHistory: history,
            primaryQuestion: primaryQuestions[i],
          });
        }
      }

      // Store question histories for regeneration
      setQuestionHistories(histories);

      // Generate summaries for each question
      generateArticle(histories, userEditedSummaries);
    }
  }, [completedQuestions, primaryQuestions, interviewComplete, questionStates, generateArticle, userEditedSummaries]);

  // Reset question states when starting over
  useEffect(() => {
    if (!interviewComplete) {
      setQuestionStates({});
      setCompletedQuestions(new Set());
      setQuestionHistories([]);
      setUserEditedSummaries({});
    }
  }, [interviewComplete]);

  const handleRegenerateSummary = () => {
    if (questionHistories.length > 0) {
      generateArticle(questionHistories, userEditedSummaries);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Letter Loop</h1>
          <p className="text-gray-600">A conversation to share with close friends</p>
        </div>

        {/* Name Input */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={interviewComplete}
          />
        </div>

        {!interviewComplete ? (
          /* Survey Interface */
          <div className="space-y-6">
            {/* Show all questions - each card is self-contained */}
            {primaryQuestions.map((question, questionIndex) => {
              const questionState = questionStates[questionIndex];
              const isComplete = completedQuestions.has(questionIndex);

              return (
                <QuestionCard
                  key={questionIndex}
                  questionIndex={questionIndex}
                  primaryQuestion={question}
                  totalQuestions={primaryQuestions.length}
                  userName={userName}
                  isComplete={isComplete}
                  onComplete={handleQuestionComplete}
                  onUpdate={handleQuestionUpdate}
                />
              );
            })}
          </div>
        ) : (
          /* Article Display */
          <ArticleDisplay
            article={article}
            emailSent={emailSent}
            isLoading={isLoading}
            isSendingEmail={isSendingEmail}
            primaryQuestions={primaryQuestions}
            questionSummaries={questionSummaries}
            questionLoadingStates={questionLoadingStates}
            userEditedSummaries={userEditedSummaries}
            onRegenerateSummary={handleRegenerateSummary}
            onSendEmail={handleSendEmail}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </div>
  );
}
