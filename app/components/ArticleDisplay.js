'use client';

import { Copy, RefreshCw, Mail, RotateCw } from 'lucide-react';
import { useState } from 'react';

export default function ArticleDisplay({
  article,
  emailSent,
  isLoading,
  isSendingEmail,
  primaryQuestions,
  questionSummaries,
  questionLoadingStates,
  userEditedSummaries,
  onCopyArticle,
  onRegenerateSummary,
  onSendEmail,
  onStartOver,
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyArticle = () => {
    navigator.clipboard.writeText(article);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
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

      {/* User Edited Summaries Section */}
      {Object.keys(userEditedSummaries || {}).length > 0 && (
        <div className="mb-8 pb-8 border-b-2 border-gray-300">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Summary</h2>
          <div className="space-y-8">
            {primaryQuestions.map((question, questionIndex) => {
              const userSummary = userEditedSummaries[questionIndex];
              if (!userSummary) return null;

              return (
                <div key={questionIndex} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">
                    {question}
                  </h3>
                  <div className="prose prose-lg max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200">
                      {userSummary}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">AI Summary</h2>
      </div>

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
          onClick={onRegenerateSummary}
          disabled={isLoading}
          className="flex items-center space-x-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCw size={20} />
          <span>{isLoading ? 'Regenerating...' : 'Regenerate Summary'}</span>
        </button>
        <button
          onClick={onSendEmail}
          disabled={isSendingEmail}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Mail size={20} />
          <span>{isSendingEmail ? 'Sending...' : 'Send Email'}</span>
        </button>
        <button
          onClick={onStartOver}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <RefreshCw size={20} />
          <span>Start Over</span>
        </button>
      </div>
    </div>
  );
}

