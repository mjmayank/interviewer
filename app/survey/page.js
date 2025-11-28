'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, RefreshCw, Mail, RotateCw } from 'lucide-react';
import { useInterview } from '../hooks/useInterview';
import QuestionCard from '../components/QuestionCard';

export default function SurveyPage() {
  const [isCopied, setIsCopied] = useState(false);
  const [questionStates, setQuestionStates] = useState({});
  const [completedQuestions, setCompletedQuestions] = useState(new Set());
  const [questionHistories, setQuestionHistories] = useState([]);

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
      generateArticle(histories);
    }
  }, [completedQuestions, primaryQuestions, interviewComplete, questionStates, generateArticle]);

  // Reset question states when starting over
  useEffect(() => {
    if (!interviewComplete) {
      setQuestionStates({});
      setCompletedQuestions(new Set());
      setQuestionHistories([]);
    }
  }, [interviewComplete]);

  const handleCopyArticle = () => {
    navigator.clipboard.writeText(article);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRegenerateSummary = () => {
    if (questionHistories.length > 0) {
      generateArticle(questionHistories);
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
          <div className="bg-white rounded-lg shadow-lg p-8">
            {emailSent && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                ✓ Email sent successfully
              </div>
            )}

            {isLoading && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm">Generating summaries for each question...</p>
              </div>
            )}

            <div className="space-y-8 mb-6">
              {primaryQuestions.map((question, questionIndex) => {
                const summary = questionSummaries[questionIndex];
                const isGenerating = questionLoadingStates[questionIndex];

                return (
                  <div key={questionIndex} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                      {question}
                    </h2>
                    {isGenerating ? (
                      <div className="text-center py-8">
                        <div className="flex justify-center space-x-2 mb-4">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.4s' }}
                          ></div>
                        </div>
                        <p className="text-gray-500 text-sm">Generating summary...</p>
                      </div>
                    ) : summary ? (
                      <div className="prose prose-lg max-w-none">
                        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                          {summary.startsWith('API Error') || summary.startsWith('Error:') ? (
                            <div className="text-red-600 italic">{summary}</div>
                          ) : (
                            summary
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic">No summary available</div>
                    )}
                  </div>
                );
              })}
            </div>

                <div className="flex space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCopyArticle}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Copy size={20} />
                    <span>{isCopied ? 'Copied!' : 'Copy Article'}</span>
                  </button>
                  <button
                    onClick={handleRegenerateSummary}
                    disabled={isLoading}
                    className="flex items-center space-x-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCw size={20} />
                    <span>{isLoading ? 'Regenerating...' : 'Regenerate Summary'}</span>
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Mail size={20} />
                    <span>{isSendingEmail ? 'Sending...' : 'Send Email'}</span>
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="flex items-center space-x-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <RefreshCw size={20} />
                    <span>Start Over</span>
                  </button>
                </div>
          </div>
        )}
      </div>
    </div>
  );
}
