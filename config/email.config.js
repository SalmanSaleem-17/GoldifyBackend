/**
 * Email Configuration
 * Central configuration for email service
 */

module.exports = {
  // Email service configuration
  transport: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  },

  // Default sender information
  from: {
    name: "Goldify",
    email: process.env.EMAIL_USER,
  },

  // Email expiration times
  expiration: {
    otp: 10 * 60 * 1000, // 10 minutes in milliseconds
    resetToken: 30 * 60 * 1000, // 30 minutes in milliseconds
  },

  // Frontend URLs
  urls: {
    frontend: process.env.FRONTEND_URL,
    resetPassword: (token) =>
      `${process.env.FRONTEND_URL}/reset-password/${token}`,
  },
};
