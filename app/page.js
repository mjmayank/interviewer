'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Copy, RefreshCw, Mail } from 'lucide-react';
import { useInterview } from './hooks/useInterview';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
  } = useInterview();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    await submitAnswer(userMessage);

    // Maintain focus on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyArticle = () => {
    navigator.clipboard.writeText(article);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
          /* Chat Interface */
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'assistant' && !interviewComplete && (
                    <button
                      onClick={handleSkipQuestion}
                      disabled={isLoading}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Skip question
                    </button>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="text-xs text-gray-500 mb-2 text-center">
                ai responds 5 seconds after you stop typing • type "GENERATE_SUMMARY" to end early
              </div>
              <div className="flex space-x-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Share your thoughts..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
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
