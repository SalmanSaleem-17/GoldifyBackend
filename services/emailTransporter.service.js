//services/emailTransporter.service.js

/**
 * Email Transporter Service
 * Handles email transport configuration and sending
 */

const nodemailer = require("nodemailer");
const emailConfig = require("../config/email.config");

class EmailTransporter {
  constructor() {
    this.transporter = null;
  }

  /**
   * Initialize email transporter
   * @returns {Object} Nodemailer transporter instance
   */
  getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport(emailConfig.transport);
    }
    return this.transporter;
  }

  /**
   * Send email
   * @param {Object} mailOptions - Email options
   * @returns {Promise} Send result
   */
  async sendEmail(mailOptions) {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Email sending failed:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Verify transporter connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      console.log("✅ Email server connection verified");
      return true;
    } catch (error) {
      console.error("❌ Email server connection failed:", error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailTransporter();
