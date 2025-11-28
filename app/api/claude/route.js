import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const {
      conversationHistory,
      isGeneratingArticle,
      userName,
      currentQuestionIndex = 0,
      primaryQuestions = [],
      followUpCount = 0,
      userCharacterCount = 0
    } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = isGeneratingArticle
      ? `Create a ~400 word summary of this conversation with ${userName || 'our friend'} for a newsletter going to close friends.

IMPORTANT GUIDELINES:
- Include several EXACT QUOTES from their responses (use quotation marks)
- Focus on summarizing and sharing the interesting concepts and ideas they expressed
- DO NOT editorialize or add your own commentary
- DO NOT frame it as "in our interview" or pretend this was a formal interview
- DO NOT use phrases like "when asked about" or "they reflected on"
- Just present what they said and thought about these topics naturally
- Segment by the topics discussed

Write in a straightforward, warm tone. Let their words and ideas speak for themselves. Use exact quotes to capture their voice.`
      : (() => {
          const currentQuestion = primaryQuestions[currentQuestionIndex] || '';

          // Note: The application state enforces a maximum of 2 follow-up questions per question.
          // Claude will never be called if 2 follow-ups have already been asked, so we don't need
          // to ask Claude to enforce this limit. We can still mention it for context.
          return `You are conducting a casual, friendly interview for a newsletter going to close friends. Write in ALL LOWERCASE, but use efficient, robotic language. No caps, no formal punctuation. Do not pretend to have a personality.

You are currently exploring this primary question: "${currentQuestion}"

Your role is to ask follow-up questions to go deeper. Ask follow-up questions to get their reasoning, personal experiences that shaped their view, specific examples, how they really feel.

IMPORTANT: Ask ONLY open-ended questions. Do NOT offer multiple choice options or yes/no questions. Do NOT present options like "is it X or Y?" or "do you think A, B, or C?". Ask questions that invite free-form responses.

Use casual follow-ups like "what made you start thinking about it that way?" "can you give me a specific example?" "how does that make you feel?" "has that changed over time?"

Do not editorialize your responses and take the conversation in a new direction. Just ask clarifying questions based on what they said.

When you feel satisfied that you've explored the question thoroughly (their view is clear and you have good depth), respond with exactly 'QUESTION_COMPLETE' to signal that this question is done.

Keep everything lowercase, robotic and efficient.`;
        })();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      return NextResponse.json(
        { error: `API Error (${response.status}): ${errorData}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ content: data.content[0].text });
  } catch (error) {
    console.error('Error calling Claude:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

