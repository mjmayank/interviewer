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
  const [questionSummaries, setQuestionSummaries] = useState({});
  const [questionLoadingStates, setQuestionLoadingStates] = useState({});
  const [userEditedSummaries, setUserEditedSummaries] = useState({});

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
  const callClaude = useCallback(async (conversationHistory, isGeneratingArticle = false, primaryQuestion = '') => {
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
          primaryQuestion,
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
  const sendEmail = useCallback(async (conversationHistory, summary, error, userEditedSummaries = {}) => {
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
          userEditedSummaries,
          primaryQuestions,
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
   * Generates summaries for each question individually
   * Accepts an array of objects with { questionIndex, conversationHistory, primaryQuestion }
   * and optionally userEditedSummaries object
   */
  const generateArticle = useCallback(async (questionHistories, userEditedSummaries = {}) => {
    setIsLoading(true);
    setInterviewComplete(true);
    setQuestionSummaries({});

    // Initialize loading states for all questions
    const initialLoadingStates = {};
    questionHistories.forEach(({ questionIndex }) => {
      initialLoadingStates[questionIndex] = true;
    });
    setQuestionLoadingStates(initialLoadingStates);

    // Generate summaries for all questions in parallel
    const summaryPromises = questionHistories.map(async ({ questionIndex, conversationHistory, primaryQuestion }) => {
      const articlePrompt = [
        ...conversationHistory,
        {
          role: 'user',
          content: 'Please write the newsletter summary based on our conversation so far.',
        },
      ];

      try {
        const generatedSummary = await callClaude(articlePrompt, true, primaryQuestion);

        // Check if the response is an error
        if (generatedSummary.startsWith('API Error') || generatedSummary.startsWith('Error:')) {
          return { questionIndex, summary: null, error: generatedSummary };
        } else {
          return { questionIndex, summary: generatedSummary, error: null };
        }
      } catch (error) {
        const errorMessage = `Error: ${error.message}`;
        return { questionIndex, summary: null, error: errorMessage };
      }
    });

    // Wait for all summaries to complete
    const results = await Promise.all(summaryPromises);

    // Update state with all summaries
    const newSummaries = {};
    const newLoadingStates = {};
    let hasErrors = false;
    const allConversationHistory = [];

    results.forEach(({ questionIndex, summary, error }) => {
      newLoadingStates[questionIndex] = false;
      if (error) {
        hasErrors = true;
        newSummaries[questionIndex] = error;
      } else {
        newSummaries[questionIndex] = summary;
      }
    });

    // Build full conversation history for email
    questionHistories.forEach(({ conversationHistory }) => {
      allConversationHistory.push(...conversationHistory);
    });

    setQuestionSummaries(newSummaries);
    setQuestionLoadingStates(newLoadingStates);

    // Combine all summaries into a single article for display/email
    const combinedArticle = primaryQuestions.map((question, index) => {
      const summary = newSummaries[index] || '';
      if (summary && !summary.startsWith('API Error') && !summary.startsWith('Error:')) {
        return `${question}\n\n${summary}`;
      }
      return null;
    }).filter(Boolean).join('\n\n---\n\n');

    setArticle(combinedArticle);
    setUserEditedSummaries(userEditedSummaries);

    // Send email with combined summaries or errors
    if (hasErrors) {
      await sendEmail(allConversationHistory, combinedArticle, 'Some summaries failed to generate', userEditedSummaries);
    } else {
      await sendEmail(allConversationHistory, combinedArticle, null, userEditedSummaries);
    }

    setIsLoading(false);
  }, [callClaude, sendEmail, primaryQuestions]);

  /**
   * Resets the interview to start over
   */
  const handleStartOver = useCallback(() => {
    setInterviewComplete(false);
    setArticle('');
    setEmailSent(false);
    setQuestionSummaries({});
    setQuestionLoadingStates({});
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
      await sendEmail(conversationHistory, null, article, userEditedSummaries);
    } else {
      // Success case - send with summary
      await sendEmail(conversationHistory, article || null, null, userEditedSummaries);
    }

    setIsSendingEmail(false);
  }, [isSendingEmail, article, sendEmail, userEditedSummaries]);

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
    questionSummaries,
    questionLoadingStates,
    userEditedSummaries,

    // Actions
    generateArticle,
    handleStartOver,
    handleSendEmail,
  };
}
