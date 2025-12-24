import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

const DEVELOPER_EMAIL = 'mjmayank@gmail.com';

export async function POST(request) {
  try {
    const { email, conversationHistory, summary, error, userEditedSummaries = {}, primaryQuestions = [] } = await request.json();

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

    // Always include developer email, and add user email if provided
    const emailList = [DEVELOPER_EMAIL];
    if (email && email.trim() && email.includes('@')) {
      emailList.push(email.trim());
    }

    // Validate required data
    if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
      return NextResponse.json(
        { error: 'conversationHistory is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate conversation history structure
    // Allow empty strings for content (for incomplete questions), but require the property to exist
    const invalidMessages = conversationHistory.filter(msg =>
      !msg ||
      !msg.role ||
      msg.content === undefined ||
      msg.content === null
    );
    if (invalidMessages.length > 0) {
      return NextResponse.json(
        { error: 'conversationHistory contains invalid messages. Each message must have role and content properties (content can be empty string).' },
        { status: 400 }
      );
    }

    // Validate summary (allow empty string for incomplete submissions)
    // Summary can be empty if questions aren't complete yet
    if (!error && summary === undefined) {
      return NextResponse.json(
        { error: 'summary is required (can be empty string for incomplete submissions)' },
        { status: 400 }
      );
    }

    // Validate error (required when no summary)
    if (error && (!error || error.trim() === '')) {
      return NextResponse.json(
        { error: 'error must be a non-empty string when provided' },
        { status: 400 }
      );
    }

    sgMail.setApiKey(sendGridApiKey);

    // Log email configuration (without sensitive data)
    console.log('SendGrid Configuration:');
    console.log('- From Email:', fromEmail);
    console.log('- To Emails:', emailList);
    console.log('- API Key configured:', !!sendGridApiKey);
    console.log('- API Key length:', sendGridApiKey?.length || 0);

    // Format conversation history
    const conversationText = conversationHistory
      .map((msg) => {
        const role = msg.role === 'user' ? 'You' : 'AI';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');

    // Format user-edited summaries
    const formatUserSummaries = (summaries, questions) => {
      if (!summaries || Object.keys(summaries).length === 0) {
        return null;
      }
      return questions
        .map((question, index) => {
          const userSummary = summaries[index];
          if (!userSummary) return null;
          return `${question}\n\n${userSummary}`;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
    };

    const userSummariesText = formatUserSummaries(userEditedSummaries, primaryQuestions);

    // Create email content
    let subject, htmlContent, textContent;

    if (error) {
      // Error case: send conversation history and error message
      subject = 'Interview Summary - Error Generating Summary';

      // Build HTML content with user summaries if available
      let userSummariesSection = '';
      let userSummariesTextSection = '';
      if (userSummariesText) {
        userSummariesSection = `
            <h3>Your Written Summary:</h3>
            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <div style="white-space: pre-wrap; word-wrap: break-word;">${userSummariesText.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        userSummariesTextSection = `Your Written Summary:\n${userSummariesText}\n\n`;
      }

      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Interview Summary - Error</h2>
            <p>There was an error generating the summary for your interview. Below is the full conversation history and the error message.</p>

            ${userSummariesSection}

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
      textContent = `Interview Summary - Error\n\n${userSummariesTextSection}Error Message:\n${error}\n\nFull Conversation History:\n${conversationText}`;
    } else {
      // Success case: send conversation history and summary
      subject = 'Interview Summary - Complete';

      // Build HTML content with user summaries if available
      let userSummariesSection = '';
      let userSummariesTextSection = '';
      if (userSummariesText) {
        userSummariesSection = `
            <h3>Your Written Summary:</h3>
            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; border-radius: 5px;">
              <div style="white-space: pre-wrap; word-wrap: break-word;">${userSummariesText.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        userSummariesTextSection = `Your Written Summary:\n${userSummariesText}\n\n`;
      }

      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Your Interview Summary</h2>
            <p>Thank you for completing the interview! Below is your generated summary and the full conversation history.</p>

            ${userSummariesSection}

            <h3>AI Generated Summary:</h3>
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
      textContent = `Your Interview Summary\n\n${userSummariesTextSection}AI Generated Summary:\n${summary}\n\nFull Conversation History:\n${conversationText}`;
    }

    const msg = {
      to: emailList,
      from: fromEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    // Log message details (without full content)
    console.log('Sending email with SendGrid:');
    console.log('- To:', msg.to);
    console.log('- From:', msg.from);
    console.log('- Subject:', msg.subject);
    console.log('- Text length:', msg.text?.length || 0);
    console.log('- HTML length:', msg.html?.length || 0);

    const response = await sgMail.send(msg);

    // Log successful response
    console.log('SendGrid response:', JSON.stringify(response, null, 2));

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    // Log full error object
    console.error('Error sending email - full error:', JSON.stringify(error, null, 2));

    // Log response if available
    if (error.response) {
      console.error('SendGrid response status:', error.response.statusCode);
      console.error('SendGrid response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('SendGrid response body:', JSON.stringify(error.response.body, null, 2));

      // Log body errors specifically
      if (error.response.body && error.response.body.errors) {
        console.error('SendGrid body errors:', JSON.stringify(error.response.body.errors, null, 2));
      }
    }

    // Extract error message from body if available
    let errorMessage = error.message || 'Failed to send email';
    if (error.response && error.response.body && error.response.body.errors) {
      const bodyErrors = error.response.body.errors.map(err => err.message || err).join('; ');
      errorMessage = `SendGrid Error: ${bodyErrors}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: error.response?.statusCode || 500 }
    );
  }
}

