/**
 * Email Templates - Refined Minimalist Design
 * Elegant, clean HTML email templates with sophisticated color palette
 */

const emailConfig = require("../config/email.config");

/**
 * Refined Minimalist Base Template
 * Color Palette: Deep Navy (#0F172A), Warm Gold (#D4AF37), Soft Gray (#F8FAFC)
 */
const baseTemplate = (content, headerTitle = "Goldify") => `
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
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #334155;
      background-color: #F8FAFC;
      padding: 0;
    }
    .email-wrapper {
      background-color: #F8FAFC;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      padding: 28px 32px;
      text-align: center;
    }
    .logo {
      font-size: 18px;
      font-weight: 600;
      color: #FFFFFF;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .logo-accent {
      color: #D4AF37;
      font-size: 20px;
      margin-right: 6px;
    }
    .content {
      padding: 32px;
    }
    .content h1 {
      font-size: 20px;
      font-weight: 600;
      color: #0F172A;
      margin-bottom: 16px;
      letter-spacing: -0.3px;
    }
    .content p {
      color: #475569;
      font-size: 14px;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .content strong {
      color: #0F172A;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      padding: 11px 24px;
      background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%);
      color: #FFFFFF;
      text-decoration: none;
      border-radius: 3px;
      font-weight: 500;
      font-size: 13px;
      margin: 20px 0 16px;
      letter-spacing: 0.3px;
    }
    .otp-box {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 24px;
      text-align: center;
      border-radius: 3px;
      margin: 20px 0;
    }
    .otp-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #64748B;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 600;
      color: #0F172A;
      letter-spacing: 6px;
      font-family: 'Courier New', monospace;
      margin: 8px 0;
    }
    .otp-expiry {
      font-size: 11px;
      color: #64748B;
      margin-top: 12px;
    }
    .info-box {
      background-color: #FEF3C7;
      padding: 14px 16px;
      border-radius: 3px;
      margin: 20px 0;
      border-left: 2px solid #D4AF37;
    }
    .info-box p {
      margin: 0;
      font-size: 12px;
      color: #78350F;
      line-height: 1.5;
    }
    .link-box {
      background-color: #F8FAFC;
      padding: 12px 16px;
      border-radius: 3px;
      margin: 16px 0;
      word-break: break-all;
      border: 1px solid #E2E8F0;
    }
    .link-box p {
      margin: 0;
      font-size: 11px;
      color: #64748B;
      font-family: 'Courier New', monospace;
    }
    .checklist {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }
    .checklist li {
      padding: 10px 0;
      border-bottom: 1px solid #F1F5F9;
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
    }
    .checklist li:last-child {
      border-bottom: none;
    }
    .checklist li::before {
      content: "✓";
      color: #D4AF37;
      font-weight: 600;
      margin-right: 10px;
      font-size: 14px;
    }
    .highlight-box {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      padding: 16px 20px;
      border-radius: 3px;
      margin: 20px 0;
      border: 1px solid #F59E0B;
    }
    .highlight-box p {
      margin: 0;
      color: #78350F;
      font-size: 12px;
      line-height: 1.5;
    }
    .footer {
      background-color: #F8FAFC;
      padding: 24px 32px;
      border-top: 1px solid #E2E8F0;
    }
    .footer-links {
      margin-bottom: 16px;
      text-align: center;
    }
    .footer-links a {
      color: #64748B;
      text-decoration: none;
      font-size: 11px;
      margin: 0 12px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      font-weight: 500;
    }
    .footer-links a:hover {
      color: #0F172A;
    }
    .footer-text {
      color: #94A3B8;
      font-size: 11px;
      line-height: 1.6;
      text-align: center;
    }
    .footer-text a {
      color: #64748B;
      text-decoration: none;
      font-weight: 500;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #E2E8F0 50%, transparent 100%);
      margin: 24px 0;
    }
    .brand-bar {
      height: 3px;
      background: linear-gradient(90deg, #D4AF37 0%, #B8941F 50%, #D4AF37 100%);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .header {
        padding: 24px 20px;
      }
      .content {
        padding: 24px 20px;
      }
      .footer {
        padding: 20px;
      }
      .content h1 {
        font-size: 18px;
      }
      .otp-code {
        font-size: 28px;
        letter-spacing: 4px;
      }
      .footer-links a {
        display: block;
        margin: 8px 0;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="brand-bar"></div>
      <div class="header">
        <div class="logo">
          <span class="logo-accent">◆</span>Goldify
        </div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <div class="footer-links">
          <a href="https://goldify.pro/features">Features</a>
          <a href="https://goldify.pro/about">About</a>
          <a href="https://goldify.pro/contact">Contact</a>
        </div>
        <p class="footer-text">
          © ${new Date().getFullYear()} Goldify. All rights reserved.<br>
          Questions? <a href="https://goldify.pro/contact">Contact us</a> · 
          <a href="https://goldify.pro/newsletter/unsubscribe">Unsubscribe</a>
        </p>
      </div>
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
    <h1>Email Verification</h1>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Welcome to Goldify. Please verify your email address using the code below:</p>
    
    <div class="otp-box">
      <div class="otp-label">Verification Code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">Valid for 10 minutes</div>
    </div>
    
    <div class="info-box">
      <p><strong>Security Notice:</strong> Never share this code. Our team will never request your verification code.</p>
    </div>
    
    <p style="font-size: 12px; color: #94A3B8; margin-top: 24px;">If you didn't create an account, please ignore this email.</p>
  `;

  return baseTemplate(content, "Goldify - Verify Your Email");
};

/**
 * Password Reset Email Template
 */
const passwordResetTemplate = (name, resetURL) => {
  const content = `
    <h1>Password Reset Request</h1>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to proceed:</p>
    
    <a href="${resetURL}" class="button">Reset Password</a>
    
    <div class="info-box">
      <p><strong>Important:</strong> This link expires in 30 minutes for security.</p>
    </div>
    
    <div class="link-box">
      <p>${resetURL}</p>
    </div>
    
    <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">If you didn't request this, your password remains secure. No action needed.</p>
  `;

  return baseTemplate(content, "Goldify - Reset Your Password");
};

/**
 * Welcome Email Template
 */
const welcomeTemplate = (name) => {
  const content = `
    <h1>Welcome to Goldify</h1>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your email is verified. Your account is now active and ready to use.</p>
    
    <div class="divider"></div>
    
    <p style="font-size: 13px; font-weight: 600; color: #0F172A; margin: 16px 0 12px;">Quick Start Guide</p>
    <ul class="checklist">
      <li>Complete your profile settings</li>
      <li>Configure your preferences</li>
      <li>Explore available features</li>
      <li>Begin using Goldify</li>
    </ul>
    
    <a href="https://goldify.pro/features" class="button">Explore Features</a>
    
    <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">Need assistance? Our support team is available to help.</p>
  `;

  return baseTemplate(content, "Goldify - Welcome");
};

/**
 * Password Changed Confirmation Email
 */
const passwordChangedTemplate = (name) => {
  const content = `
    <h1>Password Updated</h1>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your password was successfully changed on ${new Date().toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    )}.</p>
    
    <div class="info-box">
      <p><strong>Didn't make this change?</strong> Contact support immediately at <a href="https://goldify.pro/contact" style="color: #78350F; font-weight: 600;">goldify.pro/contact</a></p>
    </div>
    
    <p style="font-size: 12px; color: #94A3B8; margin-top: 20px;">You may need to sign in again on all devices for security.</p>
  `;

  return baseTemplate(content, "Goldify - Password Changed");
};

/**
 * Newsletter Welcome Email Template
 */
const newsletterWelcomeTemplate = (email) => {
  const content = `
    <h1>Newsletter Subscription Confirmed</h1>
    <p>Welcome to Goldify's newsletter community.</p>
    <p style="margin-bottom: 16px;">You'll receive:</p>
    
    <ul class="checklist">
      <li>Gold market updates and price trends</li>
      <li>New feature releases and improvements</li>
      <li>Expert insights for gold businesses</li>
      <li>Exclusive offers and early access</li>
    </ul>
    
    <div class="highlight-box">
      <p><strong>Tip:</strong> Add our email to your contacts for consistent delivery.</p>
    </div>
    
    <a href="https://goldify.pro/features" class="button">Explore Goldify</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 11px; color: #94A3B8;">
      Subscribed with <strong>${email}</strong>. 
      <a href="https://goldify.pro/newsletter/unsubscribe" style="color: #64748B; text-decoration: underline;">Unsubscribe</a> anytime.
    </p>
  `;

  return baseTemplate(content, "Goldify - Newsletter Subscription");
};

module.exports = {
  otpTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  passwordChangedTemplate,
  newsletterWelcomeTemplate,
};
