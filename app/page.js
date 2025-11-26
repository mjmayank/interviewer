'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Copy, RefreshCw } from 'lucide-react';

export default function Home() {
  const [userName, setUserName] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [article, setArticle] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Start the interview automatically when component mounts
    startInterview();

    // Cleanup timer on unmount
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, []);

  // Handle debounce timer when user is typing
  useEffect(() => {
    if (!isTyping || isLoading || pendingMessages.length === 0) return;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer - wait 5 seconds after they stop typing
    const timer = setTimeout(() => {
      // Build message list from current messages state minus pending, then add all pending
      const baseMessages = messagesRef.current.slice(0, messagesRef.current.length - pendingMessages.length);
      const allMessages = [...baseMessages, ...pendingMessages];
      processMessages(allMessages);
      setPendingMessages([]);
      setIsTyping(false);
    }, 5000);

    setDebounceTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isTyping, inputValue, pendingMessages.length]);

  const callClaude = async (conversationHistory, isGeneratingArticle = false) => {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationHistory,
          isGeneratingArticle,
          userName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API request failed:', errorData);
        return `API Error (${response.status}): ${errorData.error || 'Unknown error'}`;
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error('Error calling Claude:', error);
      return `Error: ${error.message}`;
    }
  };

  const startInterview = async () => {
    setIsLoading(true);
    const initialMessage = await callClaude([
      { role: 'user', content: 'Hi! I\'m ready for your questions.' },
    ]);
    setMessages([{ role: 'assistant', content: initialMessage }]);
    setIsLoading(false);
  };

  const processMessages = async (messagesToProcess) => {
    setIsLoading(true);

    // Check if user manually triggers summary generation
    const lastMessage = messagesToProcess[messagesToProcess.length - 1];
    if (lastMessage.content === 'GENERATE_SUMMARY') {
      setInterviewComplete(true);

      // Generate the article using current conversation (excluding GENERATE_SUMMARY)
      const conversationWithoutTrigger = messagesToProcess.slice(0, -1);
      const articlePrompt = [
        ...conversationWithoutTrigger,
        {
          role: 'user',
          content: 'Please write the newsletter summary based on our conversation so far.',
        },
      ];

      const generatedArticle = await callClaude(articlePrompt, true);
      setArticle(generatedArticle);
      setIsLoading(false);
      return;
    }

    // Get Claude's response
    const claudeResponse = await callClaude(messagesToProcess);

    // Check if interview is complete
    if (claudeResponse.trim() === 'INTERVIEW_COMPLETE') {
      setInterviewComplete(true);

      // Generate the article
      const articlePrompt = [
        ...messagesToProcess,
        { role: 'assistant', content: 'INTERVIEW_COMPLETE' },
        {
          role: 'user',
          content: 'Please write the newsletter summary based on our conversation.',
        },
      ];

      const generatedArticle = await callClaude(articlePrompt, true);
      setArticle(generatedArticle);
      setIsLoading(false);
    } else {
      // Continue the interview
      setMessages([...messagesToProcess, { role: 'assistant', content: claudeResponse }]);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Add user message to display immediately
    const newMessage = { role: 'user', content: userMessage };
    setMessages([...messages, newMessage]);
    setPendingMessages([...pendingMessages, newMessage]);

    // Maintain focus on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // User just sent a message, mark as typing activity
    setIsTyping(true);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsTyping(true);
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

  const handleStartOver = () => {
    setMessages([]);
    setInputValue('');
    setInterviewComplete(false);
    setArticle('');
    setIsCopied(false);
    startInterview();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Three Questions</h1>
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
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
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

