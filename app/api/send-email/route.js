import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

export async function POST(request) {
  try {
    const { email, conversationHistory, summary, error } = await request.json();

    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!sendGridApiKey) {
      return NextResponse.json(
        { error: 'SENDGRID_API_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!fromEmail) {
      return NextResponse.json(
        { error: 'SENDGRID_FROM_EMAIL is not configured' },
        { status: 500 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    sgMail.setApiKey(sendGridApiKey);

    // Format conversation history
    const conversationText = conversationHistory
      .map((msg) => {
        const role = msg.role === 'user' ? 'You' : 'AI';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');

    // Create email content
    let subject, htmlContent, textContent;

    if (error) {
      // Error case: send conversation history and error message
      subject = 'Interview Summary - Error Generating Summary';
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Interview Summary - Error</h2>
            <p>There was an error generating the summary for your interview. Below is the full conversation history and the error message.</p>

            <h3>Error Message:</h3>
            <div style="background-color: #fee; border-left: 4px solid #f00; padding: 10px; margin: 10px 0;">
              <pre style="white-space: pre-wrap; word-wrap: break-word;">${error}</pre>
            </div>

            <h3>Full Conversation History:</h3>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <pre style="white-space: pre-wrap; word-wrap: break-word;">${conversationText}</pre>
            </div>
          </body>
        </html>
      `;
      textContent = `Interview Summary - Error\n\nError Message:\n${error}\n\nFull Conversation History:\n${conversationText}`;
    } else {
      // Success case: send conversation history and summary
      subject = 'Interview Summary - Complete';
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Your Interview Summary</h2>
            <p>Thank you for completing the interview! Below is your generated summary and the full conversation history.</p>

            <h3>Generated Summary:</h3>
            <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <div style="white-space: pre-wrap; word-wrap: break-word;">${summary}</div>
            </div>

            <h3>Full Conversation History:</h3>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${conversationText}</pre>
            </div>
          </body>
        </html>
      `;
      textContent = `Your Interview Summary\n\nGenerated Summary:\n${summary}\n\nFull Conversation History:\n${conversationText}`;
    }

    const msg = {
      to: email,
      from: fromEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

