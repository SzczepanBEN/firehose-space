/**
 * Email service for sending magic links using Resend API
 * Can be easily swapped for other email providers
 */

interface EmailProvider {
  sendEmail(to: string, subject: string, html: string): Promise<boolean>;
}

class ResendEmailProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Firehose <noreply@firehose.space>',
          to: [to],
          subject,
          html,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      return false;
    }
  }
}

// Fallback email provider for development/testing
class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    console.log('=== EMAIL SEND (Console Provider) ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML: ${html}`);
    console.log('=====================================');
    return true;
  }
}

export class EmailService {
  private provider: EmailProvider;

  constructor(resendApiKey?: string) {
    if (resendApiKey) {
      this.provider = new ResendEmailProvider(resendApiKey);
    } else {
      console.warn('No email API key provided, using console provider for development');
      this.provider = new ConsoleEmailProvider();
    }
  }

  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    const subject = 'Your Magic Link for Firehose.space';
    const html = this.generateMagicLinkEmail(email, magicLink);
    
    return await this.provider.sendEmail(email, subject, html);
  }

  private generateMagicLinkEmail(email: string, magicLink: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Magic Link for Firehose.space</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 24px;
            font-weight: bold;
            color: #EA580C;
        }
        .logo-icon {
            width: 32px;
            height: 32px;
            background: #EA580C;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .button {
            display: inline-block;
            background-color: #EA580C;
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #C2410C;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
        .code {
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <div class="logo-icon">🔥</div>
            Firehose
        </div>
    </div>

    <h1>Welcome to Firehose! 🚀</h1>
    
    <p>Hi there!</p>
    
    <p>You requested to sign in to <strong>Firehose.space</strong> using the email address <span class="code">${email}</span>.</p>
    
    <p>Click the button below to complete your login:</p>
    
    <div style="text-align: center; margin: 40px 0;">
        <a href="${magicLink}" class="button">Sign In to Firehose</a>
    </div>
    
    <p>Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 14px;">
        ${magicLink}
    </p>
    
    <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #92400E;">
            <strong>⚠️ Security note:</strong> This link expires in 15 minutes and can only be used once. If you didn't request this login, you can safely ignore this email.
        </p>
    </div>

    <div class="footer">
        <p>
            This email was sent to <strong>${email}</strong> because you requested a magic link for Firehose.space.
        </p>
        <p>
            <a href="https://firehose.space">Firehose.space</a> - The global feed of links and articles
        </p>
    </div>
</body>
</html>
`;
  }

  async sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
    const subject = 'Welcome to Firehose.space! 🎉';
    const html = this.generateWelcomeEmail(email, displayName);
    
    return await this.provider.sendEmail(email, subject, html);
  }

  private generateWelcomeEmail(email: string, displayName: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Firehose.space!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 24px;
            font-weight: bold;
            color: #EA580C;
        }
        .logo-icon {
            width: 32px;
            height: 32px;
            background: #EA580C;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .button {
            display: inline-block;
            background-color: #EA580C;
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .feature-list {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <div class="logo-icon">🔥</div>
            Firehose
        </div>
    </div>

    <h1>Welcome to the Firehose, ${displayName}! 🔥</h1>
    
    <p>You've just joined the global feed where content flows freely and the community decides what rises to the top.</p>
    
    <div class="feature-list">
        <h3>Here's what you can do:</h3>
        <ul>
            <li><strong>📝 Submit posts:</strong> Share interesting links or write your own articles</li>
            <li><strong>👍 Vote:</strong> Upvote great content to help it reach more people</li>
            <li><strong>💬 Comment:</strong> Join discussions and share your thoughts</li>
            <li><strong>🏆 Build reputation:</strong> Earn points through upvotes and clicks</li>
            <li><strong>🚀 Go viral:</strong> No algorithms, just pure community curation</li>
        </ul>
    </div>
    
    <div style="text-align: center; margin: 40px 0;">
        <a href="https://firehose.space/submit" class="button">Submit Your First Post</a>
    </div>
    
    <p><strong>Quick tip:</strong> You can submit one post per day, so make it count! The community loves:</p>
    <ul>
        <li>🔬 Interesting technical articles</li>
        <li>🚀 Cool projects and demos</li>
        <li>💡 Useful tools and resources</li>
        <li>📚 Educational content</li>
        <li>🎯 Well-written personal experiences</li>
    </ul>

    <div class="footer">
        <p>
            Thanks for joining Firehose.space! Questions? Reply to this email or check out our 
            <a href="https://firehose.space/guidelines">community guidelines</a>.
        </p>
        <p>
            <a href="https://firehose.space">Firehose.space</a> - No gatekeeping, just pure content flow
        </p>
    </div>
</body>
</html>
`;
  }
}
