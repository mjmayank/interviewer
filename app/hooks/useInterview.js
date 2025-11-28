'use client';

import { useState, useEffect, useCallback } from 'react';

const DEVELOPER_EMAIL = 'mjmayank@gmail.com';

export function useInterview() {
  // Core state
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [article, setArticle] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Interview state
  const [primaryQuestions, setPrimaryQuestions] = useState([]);

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/questions');
        if (response.ok) {
          const data = await response.json();
          setPrimaryQuestions(data.questions);
        } else {
          console.error('Failed to fetch questions');
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };

    fetchQuestions();
  }, []);

  /**
   * Calls the Claude API with the conversation history
   */
  const callClaude = useCallback(async (conversationHistory, isGeneratingArticle = false) => {
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
          currentQuestionIndex: 0, // Not used in new structure but kept for API compatibility
          primaryQuestions,
          followUpCount: 0, // Not used in new structure but kept for API compatibility
          userCharacterCount: 0, // Not used in new structure but kept for API compatibility
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
  }, [userName, primaryQuestions]);

  /**
   * Sends email with conversation history and summary/error
   */
  const sendEmail = useCallback(async (conversationHistory, summary, error) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: DEVELOPER_EMAIL,
          conversationHistory,
          summary,
          error,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send email:', errorData);
        return;
      }

      setEmailSent(true);
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }, []);

  /**
   * Generates the article and sends email
   * Accepts conversationHistory as parameter (built by the survey page from question states)
   */
  const generateArticle = useCallback(async (conversationHistory) => {
    setIsLoading(true);
    setInterviewComplete(true);

    const articlePrompt = [
      ...conversationHistory,
      {
        role: 'user',
        content: 'Please write the newsletter summary based on our conversation so far.',
      },
    ];

    try {
      const generatedArticle = await callClaude(articlePrompt, true);

      // Check if the response is an error
      if (generatedArticle.startsWith('API Error') || generatedArticle.startsWith('Error:')) {
        // Error generating summary - send email with error
        await sendEmail(conversationHistory, null, generatedArticle);
      } else {
        // Success - send email with summary
        setArticle(generatedArticle);
        await sendEmail(conversationHistory, generatedArticle, null);
      }
    } catch (error) {
      // Error generating summary - send email with error
      const errorMessage = `Error: ${error.message}`;
      await sendEmail(conversationHistory, null, errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [callClaude, sendEmail]);

  /**
   * Resets the interview to start over
   */
  const handleStartOver = useCallback(() => {
    setInterviewComplete(false);
    setArticle('');
    setEmailSent(false);
  }, []);

  /**
   * Sends email manually
   */
  const handleSendEmail = useCallback(async () => {
    if (isSendingEmail) return;

    setIsSendingEmail(true);

    // Build conversation history from article context if needed
    // For now, we'll send with the article we have
    const conversationHistory = []; // Empty since we don't have access to full history here

    // Check if article is an error message
    if (article && (article.startsWith('API Error') || article.startsWith('Error:'))) {
      await sendEmail(conversationHistory, null, article);
    } else {
      // Success case - send with summary
      await sendEmail(conversationHistory, article || null, null);
    }

    setIsSendingEmail(false);
  }, [isSendingEmail, article, sendEmail]);

  return {
    // State
    userName,
    setUserName,
    isLoading,
    interviewComplete,
    article,
    emailSent,
    isSendingEmail,
    primaryQuestions,

    // Actions
    generateArticle,
    handleStartOver,
    handleSendEmail,
  };
}
