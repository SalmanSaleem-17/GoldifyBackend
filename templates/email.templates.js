/**
 * Email Templates
 * Professional HTML email templates for various purposes
 */

const emailConfig = require("../config/email.config");

/**
 * Base email template wrapper
 */
const baseTemplate = (content, headerTitle = "🏆 Goldify") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${headerTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
      padding: 20px;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 32px;
      font-weight: 700;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #d97706;
      font-size: 24px;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .content p {
      color: #4b5563;
      font-size: 16px;
      margin-bottom: 16px;
      line-height: 1.7;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      color: #6b7280;
      font-size: 14px;
      margin: 5px 0;
    }
    .footer a {
      color: #d97706;
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      body {
        padding: 10px;
      }
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 26px;
      }
      .content {
        padding: 30px 20px;
      }
      .content h2 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <h1>${headerTitle}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Goldify. All rights reserved.</p>
      <p>
        Need help? <a href="mailto:${emailConfig.from.email}">Contact Support</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * OTP Email Template
 */
const otpTemplate = (name, otp) => {
  const content = `
    <h2>Welcome to Goldify, ${name}! 👋</h2>
    <p>Thank you for registering with us. We're excited to have you on board!</p>
    <p>To complete your registration and verify your email address, please use the One-Time Password (OTP) below:</p>
    
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px dashed #f59e0b; padding: 30px; text-align: center; border-radius: 12px; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; color: #78716c; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
      <div style="font-size: 42px; font-weight: 800; color: #d97706; letter-spacing: 10px; font-family: 'Courier New', monospace; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
        ${otp}
      </div>
      <p style="margin: 15px 0 0 0; color: #92400e; font-size: 13px; font-weight: 500;">
        ⏰ Valid for 10 minutes
      </p>
    </div>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #78716c; font-size: 14px;">
        <strong>Security Tip:</strong> Never share this code with anyone. Our team will never ask for your OTP.
      </p>
    </div>
    
    <p>If you didn't create an account with Goldify, please ignore this email or contact our support team if you have concerns.</p>
    
    <p style="margin-top: 30px; color: #4b5563;">
      Best regards,<br>
      <strong style="color: #d97706;">The Goldify Team</strong>
    </p>
  `;

  return baseTemplate(content, "🏆 Goldify - Verify Your Email");
};

/**
 * Password Reset Email Template
 */
const passwordResetTemplate = (name, resetURL) => {
  const content = `
    <h2>Password Reset Request 🔐</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your password for your Goldify account. Don't worry, we're here to help!</p>
    
    <p>Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 35px 0;">
      <a href="${resetURL}" 
         style="display: inline-block; 
                padding: 16px 40px; 
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                color: #ffffff; 
                text-decoration: none; 
                border-radius: 10px; 
                font-weight: 700; 
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);
                transition: all 0.3s ease;">
        Reset My Password
      </a>
    </div>
    
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        <strong>⚠️ Important:</strong> This link will expire in <strong>30 minutes</strong> for security reasons.
      </p>
    </div>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
        <strong>Can't click the button?</strong> Copy and paste this link into your browser:
      </p>
      <p style="margin: 0; word-break: break-all; color: #d97706; font-size: 13px; font-family: monospace;">
        ${resetURL}
      </p>
    </div>
    
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    
    <p style="margin-top: 30px; color: #4b5563;">
      Best regards,<br>
      <strong style="color: #d97706;">The Goldify Team</strong>
    </p>
  `;

  return baseTemplate(content, "🏆 Goldify - Reset Your Password");
};

/**
 * Welcome Email Template (after successful verification)
 */
const welcomeTemplate = (name) => {
  const content = `
    <h2>Welcome Aboard! 🎉</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Congratulations! Your email has been successfully verified and your Goldify account is now active.</p>
    
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
      <h3 style="color: #d97706; margin: 0 0 15px 0; font-size: 20px;">🚀 Ready to Get Started?</h3>
      <p style="margin: 0; color: #78716c;">
        Explore all the amazing features Goldify has to offer!
      </p>
    </div>
    
    <div style="margin: 30px 0;">
      <h3 style="color: #d97706; font-size: 18px; margin-bottom: 15px;">What's Next?</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #d97706;">✓</strong> Complete your profile
        </li>
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #d97706;">✓</strong> Set up your shop preferences
        </li>
        <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #d97706;">✓</strong> Explore our features
        </li>
        <li style="padding: 12px 0;">
          <strong style="color: #d97706;">✓</strong> Start your journey with Goldify
        </li>
      </ul>
    </div>
    
    <p>If you have any questions or need assistance, our support team is always here to help!</p>
    
    <p style="margin-top: 30px; color: #4b5563;">
      Best regards,<br>
      <strong style="color: #d97706;">The Goldify Team</strong>
    </p>
  `;

  return baseTemplate(content, "🏆 Goldify - Welcome!");
};

/**
 * Password Changed Confirmation Email
 */
const passwordChangedTemplate = (name) => {
  const content = `
    <h2>Password Successfully Changed ✅</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>This email confirms that your password has been successfully changed.</p>
    
    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0; color: #065f46; font-size: 14px;">
        <strong>✓ Confirmed:</strong> Your password was updated on ${new Date().toLocaleString()}.
      </p>
    </div>
    
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; margin: 25px 0;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">
        <strong>⚠️ Didn't make this change?</strong>
      </p>
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        If you didn't change your password, please contact our support team immediately at 
        <a href="mailto:${emailConfig.from.email}" style="color: #ef4444; font-weight: 600;">${emailConfig.from.email}</a>
      </p>
    </div>
    
    <p>For security reasons, you may need to log in again on all your devices.</p>
    
    <p style="margin-top: 30px; color: #4b5563;">
      Best regards,<br>
      <strong style="color: #d97706;">The Goldify Team</strong>
    </p>
  `;

  return baseTemplate(content, "🏆 Goldify - Password Changed");
};

module.exports = {
  otpTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  passwordChangedTemplate,
};
