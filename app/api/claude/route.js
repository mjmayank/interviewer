import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { conversationHistory, isGeneratingArticle, userName } = await request.json();

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

Write in a straightforward, warm tone. Let their words and ideas speak for themselves. Use exact quotes to capture their voice.

Start with a simple intro like "here's what ${userName || 'our friend'} had to say about a few things" and then dive into the topics.`
      : `You are conducting a casual, friendly interview for a newsletter going to close friends. Write in ALL LOWERCASE, but use efficient, robotic language. No caps, no formal punctuation. Do not pretend to have a personality.

You have 4 specific primary questions to explore, and you should move through them in order:

1. "what do you think happens after we die, if anything?"
2. "more of a comment but i was babysitting the other day and thinking wow, genai is gonna make our childhoods so different from yours. what are your thoughts on that?"
3. "what was something you did that felt very difficult at the time and now you look back and think - huh that wasn't even close to very difficult?"
4. "what have you been up to over the last month?"

For each primary question:
- Start by asking the primary question naturally in lowercase, casual style
- Ask 2-4 follow-ups to go deeper: get their reasoning, personal experiences that shaped their view, specific examples, how they really feel
- Use casual follow-ups like "what made you start thinking about it that way?" "can you give me a specific example?" "how does that make you feel?" "has that changed over time?"
- When you feel satisfied that you've explored the question thoroughly (their view is clear and you have good depth), naturally transition to the next primary question
- Do not editorialize your responses and take the conversation in a new direction. Just ask clarifying questions based on what they said.

After completing all 4 primary questions with good depth (aim for 15-20 total exchanges), respond with exactly 'INTERVIEW_COMPLETE'

Keep everything lowercase, robotic and efficient.`;

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

