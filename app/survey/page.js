'use client';

import { useState, useEffect, useMemo } from 'react';
import { Copy, RefreshCw, Mail, ArrowRight } from 'lucide-react';
import { useInterview } from '../hooks/useInterview';

export default function SurveyPage() {
  const [isCopied, setIsCopied] = useState(false);
  const [answerInputs, setAnswerInputs] = useState({});

  const {
    userName,
    setUserName,
    messages,
    isLoading,
    interviewComplete,
    article,
    emailSent,
    isSendingEmail,
    submitAnswer,
    handleSkipQuestion,
    handleStartOver,
    handleSendEmail,
    getCurrentQuestionData,
    getAllQuestionsData,
    currentQuestionIndex,
    primaryQuestions,
    questionStartMessageIndex,
  } = useInterview();

  // Memoize questions data to avoid recalculating on every render
  const allQuestionsData = useMemo(() => getAllQuestionsData(), [messages, currentQuestionIndex, primaryQuestions]);

  const currentQuestionData = getCurrentQuestionData();

  // Get messages for current question in chronological order
  const currentQuestionMessages = useMemo(() => {
    if (!currentQuestionData) return [];
    return messages.slice(questionStartMessageIndex);
  }, [messages, questionStartMessageIndex, currentQuestionData]);

  // Check if all follow-ups have been answered (3 answers total)
  const allFollowUpsAnswered = useMemo(() => {
    if (!currentQuestionData || currentQuestionData.isComplete) return false;

    const userAnswers = currentQuestionMessages.filter(msg => msg.role === 'user');
    const assistantMessages = currentQuestionMessages.filter(msg => msg.role === 'assistant');

    // We have 3 answers and the last message is from user (not waiting for follow-up)
    return userAnswers.length >= 3 &&
           currentQuestionMessages.length > 0 &&
           currentQuestionMessages[currentQuestionMessages.length - 1].role === 'user' &&
           !isLoading;
  }, [currentQuestionMessages, currentQuestionData, isLoading]);

  // Initialize answer input for the current question when a new assistant message appears
  useEffect(() => {
    if (currentQuestionData && !currentQuestionData.isComplete && !isLoading && !allFollowUpsAnswered) {
      // Find the last assistant message index in current question
      const lastAssistantIdx = currentQuestionMessages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'assistant')
        .pop()?.idx;

      if (lastAssistantIdx !== undefined) {
        const inputKey = `${currentQuestionIndex}-${lastAssistantIdx}`;
        // Only initialize if it doesn't exist yet (new follow-up question)
        setAnswerInputs(prev => {
          if (!(inputKey in prev)) {
            return {
              ...prev,
              [inputKey]: '',
            };
          }
          return prev;
        });
      }
    }

    // Initialize combined answer input when all follow-ups are answered
    if (allFollowUpsAnswered) {
      const userAnswers = currentQuestionMessages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content);
      const combinedKey = `${currentQuestionIndex}-combined`;
      setAnswerInputs(prev => {
        if (!(combinedKey in prev)) {
          return {
            ...prev,
            [combinedKey]: userAnswers.join('\n\n'),
          };
        }
        return prev;
      });
    }
  }, [currentQuestionMessages.length, currentQuestionIndex, isLoading, allFollowUpsAnswered]);

  const handleAnswerChange = (inputKey, value) => {
    setAnswerInputs(prev => ({
      ...prev,
      [inputKey]: value,
    }));
  };

  const handleSubmitAnswer = async (questionIndex, messageIndex) => {
    const answer = answerInputs[`${questionIndex}-${messageIndex}`] || '';
    if (!answer.trim() || isLoading) return;

    // Submit immediately (no 5 second delay for survey)
    await submitAnswer(answer.trim(), true);

    // Clear the input after submission
    setAnswerInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[`${questionIndex}-${messageIndex}`];
      return newInputs;
    });
  };

  const handleSubmitCombinedAnswer = async (questionIndex) => {
    const combinedKey = `${questionIndex}-combined`;
    const combinedAnswer = answerInputs[combinedKey] || '';
    if (!combinedAnswer.trim() || isLoading) return;

    // Get the current user answers
    const userAnswers = currentQuestionMessages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);

    // If the combined answer is different, we need to replace the messages
    // For now, just submit it as a new answer which will trigger question completion
    // The system will move to the next question
    await submitAnswer(combinedAnswer.trim(), true);
  };

  const handleKeyPress = (e, questionIndex, messageIndex) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitAnswer(questionIndex, messageIndex);
    }
  };

  const handleCopyArticle = () => {
    navigator.clipboard.writeText(article);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
            {/* Show all questions */}
            {allQuestionsData.map((questionData) => {
              // For completed questions, get their messages
              const questionStartIdx = questionData.isComplete
                ? messages.findIndex(
                    (msg) => msg.role === 'assistant' && msg.content === questionData.question
                  )
                : -1;
              const questionEndIdx = questionData.isComplete && questionData.questionIndex < primaryQuestions.length - 1
                ? messages.findIndex(
                    (msg) => msg.role === 'assistant' && msg.content === primaryQuestions[questionData.questionIndex + 1]
                  )
                : questionData.isComplete
                ? messages.length
                : -1;
              const questionMessages = questionStartIdx !== -1 ? messages.slice(questionStartIdx, questionEndIdx) : [];

              // Determine question state
              const isCompleted = questionData.isComplete;
              const isCurrent = questionData.isCurrent && !questionData.isComplete;
              const isFuture = !isCompleted && !isCurrent;

              return (
                <div
                  key={questionData.questionIndex}
                  className={`bg-white rounded-lg shadow-lg p-6 ${
                    isCurrent ? 'ring-2 ring-blue-500' : ''
                  } ${isCompleted ? 'opacity-75' : ''} ${isFuture ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-sm font-semibold text-blue-600">
                      Question {questionData.questionIndex + 1} of {questionData.totalQuestions}
                    </span>
                    {isCompleted && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Complete
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                    {isFuture && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        Not started
                      </span>
                    )}
                  </div>

                  {/* Show question text */}
                  {isFuture && (
                    <div className="mb-4">
                      <p className="text-base text-gray-800">{questionData.question}</p>
                    </div>
                  )}

                  {/* Show Q&A pairs for completed questions */}
                  {isCompleted && questionMessages.map((msg, idx) => (
                    <div key={idx} className="mb-4">
                      {msg.role === 'assistant' && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {idx === 0 ? 'Question:' : 'Follow-up:'}
                          </p>
                          <p className="text-base text-gray-800">{msg.content}</p>
                        </div>
                      )}
                      {msg.role === 'user' && (
                        <div className="ml-4 mb-2">
                          <p className="text-sm font-medium text-gray-700 mb-1">Your Answer:</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Show current question with interactive interface */}
                  {isCurrent && currentQuestionMessages.map((msg, idx) => {
                  const isLastMessage = idx === currentQuestionMessages.length - 1;
                  const isAssistant = msg.role === 'assistant';
                  const inputKey = `${currentQuestionIndex}-${idx}`;
                  // Show input after the last assistant message, but not while loading (waiting for follow-up)
                  const showInputAfterThis = isAssistant && isLastMessage && !isLoading;

                  return (
                    <div key={idx} className="mb-4">
                      {isAssistant && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {idx === 0 ? 'Question:' : 'Follow-up:'}
                          </p>
                          <p className="text-base text-gray-800 mb-3">{msg.content}</p>
                        </div>
                      )}

                      {msg.role === 'user' && (
                        <div className="ml-4 mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Your Answer:</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}

                      {/* Show text box after the last assistant message (when not loading) */}
                      {showInputAfterThis && (
                        <div className="space-y-3 mt-4">
                          <textarea
                            value={answerInputs[inputKey] || ''}
                            onChange={(e) => handleAnswerChange(inputKey, e.target.value)}
                            onKeyDown={(e) => handleKeyPress(e, currentQuestionIndex, idx)}
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
                                onClick={() => handleSkipQuestion()}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                              >
                                <span>Skip</span>
                              </button>
                              <button
                                onClick={() => handleSubmitAnswer(currentQuestionIndex, idx)}
                                disabled={isLoading || !answerInputs[inputKey]?.trim()}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                              >
                                <span>Submit</span>
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Loading indicator after user message if processing */}
                      {msg.role === 'user' && isLastMessage && isLoading && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                            style={{ animationDelay: '0.4s' }}
                          ></div>
                          <span>Processing your answer...</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                  {/* Show loading indicator if waiting for follow-up after last assistant message */}
                  {isCurrent && currentQuestionMessages.length > 0 &&
                   currentQuestionMessages[currentQuestionMessages.length - 1].role === 'assistant' &&
                   isLoading && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      ></div>
                      <span>Waiting for follow-up question...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Article Display */
          <div className="bg-white rounded-lg shadow-lg p-8">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
                <p className="text-gray-600">Crafting your year in review article...</p>
              </div>
            ) : (
              <>
                {emailSent && (
                  <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                    ✓ Email sent successfully
                  </div>
                )}

                <div className="prose prose-lg max-w-none mb-6">
                  <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                    {article}
                  </div>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
