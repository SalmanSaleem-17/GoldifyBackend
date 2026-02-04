/**
 * Email Service
 * Main service for handling all email operations
 */

const emailTransporter = require("./emailTransporter.service");
const emailTemplates = require("../templates/email.templates");
const emailConfig = require("../config/email.config");

class EmailService {
  /**
   * Send OTP verification email
   * @param {string} email - Recipient email
   * @param {string} otp - One-Time Password
   * @param {string} name - User's name
   * @returns {Promise}
   */
  async sendOTPEmail(email, otp, name) {
    try {
      const mailOptions = {
        from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
        to: email,
        subject: "Verify Your Email - Goldify",
        html: emailTemplates.otpTemplate(name, otp),
      };

      await emailTransporter.sendEmail(mailOptions);
      console.log(`📧 OTP email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} name - User's name
   * @returns {Promise}
   */
  async sendPasswordResetEmail(email, resetToken, name) {
    try {
      const resetURL = emailConfig.urls.resetPassword(resetToken);

      const mailOptions = {
        from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
        to: email,
        subject: "Password Reset Request - Goldify",
        html: emailTemplates.passwordResetTemplate(name, resetURL),
      };

      await emailTransporter.sendEmail(mailOptions);
      console.log(`📧 Password reset email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw new Error("Failed to send password reset email");
    }
  }

  /**
   * Send welcome email after successful verification
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @returns {Promise}
   */
  async sendWelcomeEmail(email, name) {
    try {
      const mailOptions = {
        from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
        to: email,
        subject: "Welcome to Goldify! 🎉",
        html: emailTemplates.welcomeTemplate(name),
      };

      await emailTransporter.sendEmail(mailOptions);
      console.log(`📧 Welcome email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      // Don't throw error for welcome emails as they're not critical
      return { success: false };
    }
  }

  /**
   * Send password changed confirmation email
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @returns {Promise}
   */
  async sendPasswordChangedEmail(email, name) {
    try {
      const mailOptions = {
        from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
        to: email,
        subject: "Password Changed Successfully - Goldify",
        html: emailTemplates.passwordChangedTemplate(name),
      };

      await emailTransporter.sendEmail(mailOptions);
      console.log(`📧 Password changed email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to send password changed email:", error);
      // Don't throw error for confirmation emails as they're not critical
      return { success: false };
    }
  }

  /**
   * Verify email service connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    return await emailTransporter.verifyConnection();
  }
}

// Export singleton instance
module.exports = new EmailService();
