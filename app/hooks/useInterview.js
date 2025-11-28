'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const DEVELOPER_EMAIL = 'mjmayank@gmail.com';
const DEBOUNCE_DELAY = 5000; // 5 seconds

export function useInterview() {
  // Core state
  const [userName, setUserName] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [article, setArticle] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Interview state
  const [primaryQuestions, setPrimaryQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [followUpCounts, setFollowUpCounts] = useState({}); // Maps questionIndex -> follow-up count
  const [userCharacterCount, setUserCharacterCount] = useState(0);

  // Debounce timer ref
  const debounceTimerRef = useRef(null);

  /**
   * Finds the index where the current question starts in the messages array
   */
  const findQuestionStartIndex = useCallback((messagesArray, questionIndex, questions) => {
    if (questionIndex === 0) {
      return 0;
    }

    // Find the last occurrence of the previous question
    const previousQuestion = questions[questionIndex - 1];

    for (let i = messagesArray.length - 1; i >= 0; i--) {
      if (messagesArray[i].role === 'assistant' && messagesArray[i].content === previousQuestion) {
        // The next assistant message after this is the start of current question
        for (let j = i + 1; j < messagesArray.length; j++) {
          if (messagesArray[j].role === 'assistant') {
            return j;
          }
        }
        return i + 1;
      }
    }

    // Fallback: if previous question not found, return 0
    return 0;
  }, []);

  // Memoized derived state
  const questionStartIndex = useMemo(() => {
    return findQuestionStartIndex(messages, currentQuestionIndex, primaryQuestions);
  }, [messages, currentQuestionIndex, primaryQuestions, findQuestionStartIndex]);

  const messagesSinceQuestionStart = useMemo(() => {
    return messages.slice(questionStartIndex);
  }, [messages, questionStartIndex]);

  const assistantMessagesForCurrentQuestion = useMemo(() => {
    return messagesSinceQuestionStart.filter(msg => msg.role === 'assistant');
  }, [messagesSinceQuestionStart]);

  const currentFollowUpCount = useMemo(() => {
    // The first assistant message is the initial question, so follow-ups = total - 1
    return Math.max(0, assistantMessagesForCurrentQuestion.length - 1);
  }, [assistantMessagesForCurrentQuestion]);

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

    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Start interview when questions are loaded
  useEffect(() => {
    if (primaryQuestions.length > 0) {
      startInterview();
    }
  }, [primaryQuestions]);

  /**
   * Calls the Claude API with the conversation history
   */
  const callClaude = useCallback(async (conversationHistory, isGeneratingArticle = false, overrides = {}) => {
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
          currentQuestionIndex: overrides.currentQuestionIndex ?? currentQuestionIndex,
          primaryQuestions: overrides.primaryQuestions ?? primaryQuestions,
          followUpCount: overrides.followUpCount ?? (followUpCounts[currentQuestionIndex] ?? 0),
          userCharacterCount: overrides.userCharacterCount ?? userCharacterCount,
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
  }, [userName, currentQuestionIndex, primaryQuestions, followUpCounts, userCharacterCount]);

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
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }, []);

  /**
   * Starts the interview with the first question
   */
  const startInterview = useCallback(() => {
    if (primaryQuestions.length === 0) return;

    setCurrentQuestionIndex(0);
    setFollowUpCounts({});
    setUserCharacterCount(0);

    // Add first question directly (no API call needed)
    const firstQuestion = primaryQuestions[0];
    const initialAssistantMessage = { role: 'assistant', content: firstQuestion };

    setMessages([initialAssistantMessage]);
  }, [primaryQuestions]);

  /**
   * Generates the article and sends email
   */
  const generateArticle = useCallback(async (conversationHistory) => {
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
    }
  }, [callClaude, sendEmail]);

  /**
   * Moves to the next question or completes the interview
   */
  const moveToNextQuestion = useCallback(async (currentMessages) => {
    if (currentQuestionIndex < primaryQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      // Don't reset followUpCounts - we maintain counts per question
      setUserCharacterCount(0);

      // Add the next question directly (no API call needed)
      const nextQuestion = primaryQuestions[nextIndex];
      const nextQuestionMessage = { role: 'assistant', content: nextQuestion };

      setMessages([...currentMessages, nextQuestionMessage]);
    } else {
      // All questions complete
      setInterviewComplete(true);
      await generateArticle(currentMessages);
    }
  }, [currentQuestionIndex, primaryQuestions, generateArticle]);

  /**
   * Processes messages and handles Claude response
   */
  const processMessages = useCallback(async (messagesToProcess = null) => {
    setIsLoading(true);

    // Use provided messages or fall back to current state
    const messagesToUse = messagesToProcess ?? messages;

    // Calculate current follow-up count for the messages being processed
    const lastMessage = messagesToUse[messagesToUse.length - 1];
    const questionStart = findQuestionStartIndex(messagesToUse, currentQuestionIndex, primaryQuestions);
    const messagesSinceStart = messagesToUse.slice(questionStart);
    const assistantMessages = messagesSinceStart.filter(msg => msg.role === 'assistant');
    const followUpCountForMessages = Math.max(0, assistantMessages.length - 1);

    // Only process if the last message is from the user (they just submitted)
    // If the last message is from assistant, we're waiting for user input
    if (lastMessage.role === 'assistant') {
      setIsLoading(false);
      return;
    }

    // Check if we should move to next question BEFORE calling Claude
    // This only happens when the user submits a message
    // Move to next question if:
    // 1. We've asked 2 follow-ups AND user just submitted, OR
    // 2. User has typed 400+ characters AND user just submitted
    const shouldMoveToNext =
      (followUpCountForMessages >= 2) ||
      (userCharacterCount >= 400);

    if (shouldMoveToNext) {
      // Move to next question without calling Claude
      await moveToNextQuestion(messagesToUse);
      setIsLoading(false);
      return;
    }

    // Get Claude's response (only if we haven't reached the limit)
    const claudeResponse = await callClaude(messagesToUse);

    // Calculate new follow-up count after adding Claude's response
    // After adding this response, we'll have assistantMessages.length + 1 total
    // Follow-up count = (assistantMessages.length + 1) - 1
    const newFollowUpCount = assistantMessages.length;

    // Update follow-up count for the current question
    setFollowUpCounts(prev => ({
      ...prev,
      [currentQuestionIndex]: newFollowUpCount
    }));

    // Always add Claude's response and wait for user to submit again
    // Safety check: if Claude asked a 3rd follow-up despite our instructions, block it
    if (newFollowUpCount > 2) {
      // This shouldn't happen, but if it does, move to next question
      await moveToNextQuestion(messagesToUse);
      setIsLoading(false);
    } else {
      // Add Claude's response and wait for user to submit again
      setMessages([...messagesToUse, { role: 'assistant', content: claudeResponse }]);
      setIsLoading(false);
    }
  }, [
    messages,
    currentQuestionIndex,
    primaryQuestions,
    userCharacterCount,
    callClaude,
    generateArticle,
    moveToNextQuestion,
    findQuestionStartIndex,
  ]);

  /**
   * Submits a user answer with optional immediate processing
   */
  const submitAnswer = useCallback(async (answer, immediate = false) => {
    if (!answer.trim() || isLoading) return;

    const userMessage = answer.trim();

    // Track character count for current question
    setUserCharacterCount(prev => prev + userMessage.length);

    // Add user message to display immediately (optimistic UI)
    const newMessage = { role: 'user', content: userMessage };

    if (immediate) {
      // Process immediately without debounce
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Update messages and process immediately
      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        // Process with the updated messages
        setTimeout(() => {
          processMessages(updatedMessages);
        }, 0);
        return updatedMessages;
      });
    } else {
      // Update messages immediately for optimistic UI
      setMessages(prev => [...prev, newMessage]);

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer - wait 5 seconds after they stop typing
      // Read from state when timer fires to get latest messages
      debounceTimerRef.current = setTimeout(() => {
        setMessages(prev => {
          processMessages(prev);
          return prev;
        });
        debounceTimerRef.current = null;
      }, DEBOUNCE_DELAY);
    }
  }, [isLoading, processMessages]);

  /**
   * Skips the current question and moves to the next one
   */
  const handleSkipQuestion = useCallback(async () => {
    if (isLoading) return;

    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Move to next question
    if (currentQuestionIndex < primaryQuestions.length - 1) {
      const skipMessage = 'Next question';
      const newMessage = { role: 'user', content: skipMessage };
      const allMessages = [...messages, newMessage];

      // Add the next question directly (no API call needed)
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = primaryQuestions[nextIndex];
      const nextQuestionMessage = { role: 'assistant', content: nextQuestion };
      const finalMessages = [...allMessages, nextQuestionMessage];

      // Update state for next question
      setCurrentQuestionIndex(nextIndex);
      // Don't reset followUpCounts - we maintain counts per question
      setUserCharacterCount(0);
      setMessages(finalMessages);
    } else {
      // Last question, complete interview
      setInterviewComplete(true);
      const skipMessage = 'Next question';
      const newMessage = { role: 'user', content: skipMessage };
      const allMessages = [...messages, newMessage];
      setMessages(allMessages);

      // Generate article
      setIsLoading(true);
      await generateArticle(allMessages);
      setIsLoading(false);
    }
  }, [isLoading, currentQuestionIndex, primaryQuestions, messages, generateArticle]);

  /**
   * Resets the interview to start over
   */
  const handleStartOver = useCallback(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setMessages([]);
    setInterviewComplete(false);
    setArticle('');
    setEmailSent(false);
    setCurrentQuestionIndex(0);
    setFollowUpCounts({});
    setUserCharacterCount(0);
    startInterview();
  }, [startInterview]);

  /**
   * Sends email manually
   */
  const handleSendEmail = useCallback(async () => {
    if (isSendingEmail) return;

    setIsSendingEmail(true);

    const conversationHistory = messages;

    // Check if article is an error message
    if (article && (article.startsWith('API Error') || article.startsWith('Error:'))) {
      await sendEmail(conversationHistory, null, article);
    } else {
      // Success case - send with summary
      await sendEmail(conversationHistory, article || null, null);
    }

    setIsSendingEmail(false);
  }, [isSendingEmail, messages, article, sendEmail]);

  /**
   * Gets current question and its answers
   */
  const getCurrentQuestionData = useCallback(() => {
    if (currentQuestionIndex >= primaryQuestions.length) return null;

    const question = primaryQuestions[currentQuestionIndex];

    // Get all user answers for this question
    const answers = messagesSinceQuestionStart
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);

    // Get all follow-up questions
    const followUps = messagesSinceQuestionStart
      .filter((msg, idx) => msg.role === 'assistant' && idx > 0) // Skip first (initial question)
      .map(msg => msg.content);

    return {
      question,
      answers,
      followUps,
      questionIndex: currentQuestionIndex,
      totalQuestions: primaryQuestions.length,
    };
  }, [currentQuestionIndex, primaryQuestions, messagesSinceQuestionStart]);

  /**
   * Gets all questions with their answers
   */
  const getAllQuestionsData = useCallback(() => {
    const questionsData = [];
    let currentQuestionStart = 0;

    for (let i = 0; i < primaryQuestions.length; i++) {
      const question = primaryQuestions[i];
      let questionEnd = messages.length;

      // Find where this question ends (start of next question or end of messages)
      if (i < primaryQuestions.length - 1) {
        // Find the next question's start
        for (let j = currentQuestionStart; j < messages.length; j++) {
          if (messages[j].role === 'assistant' &&
              messages[j].content === primaryQuestions[i + 1]) {
            questionEnd = j;
            break;
          }
        }
      }

      const questionMessages = messages.slice(currentQuestionStart, questionEnd);
      const answers = questionMessages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content);

      const followUps = questionMessages
        .filter((msg, idx) => msg.role === 'assistant' && idx > 0)
        .map(msg => msg.content);

      questionsData.push({
        question,
        answers,
        followUps,
        questionIndex: i,
        totalQuestions: primaryQuestions.length,
        isCurrent: i === currentQuestionIndex,
        isComplete: i < currentQuestionIndex,
      });

      currentQuestionStart = questionEnd;
    }

    return questionsData;
  }, [primaryQuestions, messages, currentQuestionIndex]);

  // Calculate isTyping based on whether there's a pending debounce timer
  const isTyping = debounceTimerRef.current !== null;

  return {
    // State
    userName,
    setUserName,
    messages,
    isLoading,
    interviewComplete,
    article,
    emailSent,
    isSendingEmail,
    primaryQuestions,
    currentQuestionIndex,
    followUpCount: followUpCounts[currentQuestionIndex] ?? 0, // Return current question's count for backward compatibility
    followUpCounts, // Also expose the full object
    userCharacterCount,
    isTyping,
    questionStartMessageIndex: questionStartIndex, // Keep for backward compatibility

    // Actions
    submitAnswer,
    handleSkipQuestion,
    handleStartOver,
    handleSendEmail,

    // Helpers
    getCurrentQuestionData,
    getAllQuestionsData,
  };
}

