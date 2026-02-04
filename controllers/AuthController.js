const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailService = require("../services/email.service");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// @desc    Register user (default role: user)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, country, shopName, password } = req.body;
    console.log("Register API Calling");

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email already registered. Please login.",
        });
      } else {
        // Regenerate OTP for unverified user
        const otp = existingUser.generateOTP();
        await existingUser.save();
        await emailService.sendOTPEmail(email, otp, name);

        return res.status(200).json({
          success: true,
          message: "OTP sent to your email. Please verify to continue.",
        });
      }
    }

    // Create new user with default role 'user'
    const user = await User.create({
      name,
      email,
      country,
      shopName,
      password,
      role: "user",
    });

    // Generate OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await emailService.sendOTPEmail(email, otp, name);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email for OTP.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select("+otp +otpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified. Please login.",
      });
    }

    // Check OTP validity
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (Date.now() > user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify user
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(email, user.name).catch((err) => {
      console.error("Welcome email failed:", err);
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await emailService.sendOTPEmail(email, otp, user.name);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

// @desc    Login user (role-based redirect)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      });
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await user.save();

    // Send reset email
    await emailService.sendPasswordResetEmail(email, resetToken, user.name);

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    // Hash the token
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email (non-blocking)
    emailService
      .sendPasswordChangedEmail(user.email, user.name)
      .catch((err) => {
        console.error("Password changed email failed:", err);
      });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, country, shopName } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fields
    if (name) user.name = name;
    if (country) user.country = country;
    if (shopName) user.shopName = shopName;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'user' or 'admin'",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

// const User = require("../models/User");
// const jwt = require("jsonwebtoken");
// const nodemailer = require("nodemailer");
// const crypto = require("crypto");

// // Create email transporter
// const createTransporter = () => {
//   return nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     secure: false,
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });
// };

// // Generate JWT Token with role
// const generateToken = (id) => {
//   return jwt.sign({ id }, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_EXPIRES_IN || "7d",
//   });
// };

// // Send OTP Email
// const sendOTPEmail = async (email, otp, name) => {
//   const transporter = createTransporter();

//   const mailOptions = {
//     from: `"Goldify" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: "Verify Your Email - Goldify",
//     html: `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <style>
//             body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//             .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//             .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
//             .header h1 { color: white; margin: 0; font-size: 28px; }
//             .content { background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//             .otp-box { background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; }
//             .otp-code { font-size: 36px; font-weight: bold; color: #d97706; letter-spacing: 8px; }
//             .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
//           </style>
//         </head>
//         <body>
//           <div class="container">
//             <div class="header">
//               <h1>🏆 Goldify</h1>
//             </div>
//             <div class="content">
//               <h2 style="color: #d97706;">Welcome to Goldify, ${name}!</h2>
//               <p>Thank you for registering with us. To complete your registration, please verify your email address using the OTP code below:</p>

//               <div class="otp-box">
//                 <p style="margin: 0; color: #78716c; font-size: 14px;">Your OTP Code</p>
//                 <div class="otp-code">${otp}</div>
//                 <p style="margin: 10px 0 0 0; color: #78716c; font-size: 12px;">Valid for 10 minutes</p>
//               </div>

//               <p>If you didn't create an account with Goldify, please ignore this email.</p>

//               <p style="margin-top: 30px;">Best regards,<br><strong>The Goldify Team</strong></p>
//             </div>
//             <div class="footer">
//               <p>© ${new Date().getFullYear()} Goldify. All rights reserved.</p>
//             </div>
//           </div>
//         </body>
//       </html>
//     `,
//   };

//   await transporter.sendMail(mailOptions);
// };

// // Send Password Reset Email
// const sendResetEmail = async (email, resetToken, name) => {
//   const transporter = createTransporter();
//   const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

//   const mailOptions = {
//     from: `"Goldify" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: "Password Reset Request - Goldify",
//     html: `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <style>
//             body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//             .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//             .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
//             .header h1 { color: white; margin: 0; font-size: 28px; }
//             .content { background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
//             .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
//             .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
//           </style>
//         </head>
//         <body>
//           <div class="container">
//             <div class="header">
//               <h1>🏆 Goldify</h1>
//             </div>
//             <div class="content">
//               <h2 style="color: #d97706;">Password Reset Request</h2>
//               <p>Hi ${name},</p>
//               <p>We received a request to reset your password. Click the button below to create a new password:</p>

//               <div style="text-align: center;">
//                 <a href="${resetURL}" class="button">Reset Password</a>
//               </div>

//               <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">⚠️ This link will expire in 30 minutes.</p>

//               <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>

//               <p style="margin-top: 30px;">Best regards,<br><strong>The Goldify Team</strong></p>
//             </div>
//             <div class="footer">
//               <p>© ${new Date().getFullYear()} Goldify. All rights reserved.</p>
//             </div>
//           </div>
//         </body>
//       </html>
//     `,
//   };

//   await transporter.sendMail(mailOptions);
// };

// // @desc    Register user (default role: user)
// // @route   POST /api/auth/register
// // @access  Public
// exports.register = async (req, res) => {
//   try {
//     const { name, email, country, shopName, password } = req.body;
//     console.log("Register API Calling");
//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       if (existingUser.isVerified) {
//         return res.status(400).json({
//           success: false,
//           message: "Email already registered. Please login.",
//         });
//       } else {
//         // Regenerate OTP for unverified user
//         const otp = existingUser.generateOTP();
//         await existingUser.save();
//         await sendOTPEmail(email, otp, name);

//         return res.status(200).json({
//           success: true,
//           message: "OTP sent to your email. Please verify to continue.",
//         });
//       }
//     }

//     // Create new user with default role 'user'
//     const user = await User.create({
//       name,
//       email,
//       country,
//       shopName,
//       password,
//       role: "user", // Default role
//     });

//     // Generate OTP
//     const otp = user.generateOTP();
//     await user.save();

//     // Send OTP email
//     await sendOTPEmail(email, otp, name);

//     res.status(201).json({
//       success: true,
//       message: "Registration successful! Please check your email for OTP.",
//     });
//   } catch (error) {
//     console.error("Register error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Registration failed",
//     });
//   }
// };

// // @desc    Verify OTP
// // @route   POST /api/auth/verify-otp
// // @access  Public
// exports.verifyOTP = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const user = await User.findOne({ email }).select("+otp +otpExpires");

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.isVerified) {
//       return res.status(400).json({
//         success: false,
//         message: "Email already verified. Please login.",
//       });
//     }

//     // Check OTP validity
//     if (!user.otp || user.otp !== otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP",
//       });
//     }

//     if (Date.now() > user.otpExpires) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP has expired. Please request a new one.",
//       });
//     }

//     // Verify user
//     user.isVerified = true;
//     user.otp = undefined;
//     user.otpExpires = undefined;
//     await user.save();

//     // Generate token
//     const token = generateToken(user._id);

//     res.status(200).json({
//       success: true,
//       message: "Email verified successfully!",
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         country: user.country,
//         shopName: user.shopName,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error("Verify OTP error:", error);
//     res.status(500).json({
//       success: false,
//       message: "OTP verification failed",
//     });
//   }
// };

// // @desc    Resend OTP
// // @route   POST /api/auth/resend-otp
// // @access  Public
// exports.resendOTP = async (req, res) => {
//   try {
//     const { email } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     if (user.isVerified) {
//       return res.status(400).json({
//         success: false,
//         message: "Email already verified",
//       });
//     }

//     // Generate new OTP
//     const otp = user.generateOTP();
//     await user.save();

//     // Send OTP email
//     await sendOTPEmail(email, otp, user.name);

//     res.status(200).json({
//       success: true,
//       message: "OTP sent successfully",
//     });
//   } catch (error) {
//     console.error("Resend OTP error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to resend OTP",
//     });
//   }
// };

// // @desc    Login user (role-based redirect)
// // @route   POST /api/auth/login
// // @access  Public
// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Validate input
//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide email and password",
//       });
//     }

//     // Find user and include password
//     const user = await User.findOne({ email }).select("+password");

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password",
//       });
//     }

//     // Check if user is verified
//     if (!user.isVerified) {
//       return res.status(403).json({
//         success: false,
//         message: "Please verify your email before logging in",
//       });
//     }

//     // Check password
//     const isPasswordCorrect = await user.comparePassword(password);

//     if (!isPasswordCorrect) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid email or password",
//       });
//     }

//     // Generate token
//     const token = generateToken(user._id);

//     res.status(200).json({
//       success: true,
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         country: user.country,
//         shopName: user.shopName,
//         role: user.role, // Include role for frontend redirect
//       },
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Login failed",
//     });
//   }
// };

// // @desc    Get current user
// // @route   GET /api/auth/me
// // @access  Private
// exports.getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);

//     res.status(200).json({
//       success: true,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         country: user.country,
//         shopName: user.shopName,
//         role: user.role,
//         isVerified: user.isVerified,
//       },
//     });
//   } catch (error) {
//     console.error("Get me error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch user",
//     });
//   }
// };

// // @desc    Forgot password
// // @route   POST /api/auth/forgot-password
// // @access  Public
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "No user found with this email",
//       });
//     }

//     // Generate reset token
//     const resetToken = user.generateResetToken();
//     await user.save();

//     // Send reset email
//     await sendResetEmail(email, resetToken, user.name);

//     res.status(200).json({
//       success: true,
//       message: "Password reset link sent to your email",
//     });
//   } catch (error) {
//     console.error("Forgot password error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to process request",
//     });
//   }
// };

// // @desc    Reset password
// // @route   POST /api/auth/reset-password/:resetToken
// // @access  Public
// exports.resetPassword = async (req, res) => {
//   try {
//     const { resetToken } = req.params;
//     const { password } = req.body;

//     // Hash the token
//     const hashedToken = crypto
//       .createHash("sha256")
//       .update(resetToken)
//       .digest("hex");

//     // Find user with valid token
//     const user = await User.findOne({
//       resetPasswordToken: hashedToken,
//       resetPasswordExpires: { $gt: Date.now() },
//     }).select("+resetPasswordToken +resetPasswordExpires");

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or expired reset token",
//       });
//     }

//     // Set new password
//     user.password = password;
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Password reset successful",
//     });
//   } catch (error) {
//     console.error("Reset password error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to reset password",
//     });
//   }
// };

// // @desc    Update profile
// // @route   PUT /api/auth/profile
// // @access  Private
// exports.updateProfile = async (req, res) => {
//   try {
//     const { name, country, shopName } = req.body;

//     const user = await User.findById(req.user.id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Update fields
//     if (name) user.name = name;
//     if (country) user.country = country;
//     if (shopName) user.shopName = shopName;

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         country: user.country,
//         shopName: user.shopName,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error("Update profile error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update profile",
//     });
//   }
// };

// // @desc    Get all users (Admin only)
// // @route   GET /api/auth/users
// // @access  Private/Admin
// exports.getAllUsers = async (req, res) => {
//   try {
//     const users = await User.find().select("-password");

//     res.status(200).json({
//       success: true,
//       count: users.length,
//       users,
//     });
//   } catch (error) {
//     console.error("Get all users error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch users",
//     });
//   }
// };

// // @desc    Update user role (Admin only)
// // @route   PUT /api/auth/users/:id/role
// // @access  Private/Admin
// exports.updateUserRole = async (req, res) => {
//   try {
//     const { role } = req.body;
//     const { id } = req.params;

//     if (!["user", "admin"].includes(role)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid role. Must be 'user' or 'admin'",
//       });
//     }

//     const user = await User.findById(id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     user.role = role;
//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: `User role updated to ${role}`,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error("Update user role error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update user role",
//     });
//   }
// };

// // @desc    Delete user (Admin only)
// // @route   DELETE /api/auth/users/:id
// // @access  Private/Admin
// exports.deleteUser = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const user = await User.findById(id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Prevent admin from deleting themselves
//     if (user._id.toString() === req.user.id) {
//       return res.status(400).json({
//         success: false,
//         message: "You cannot delete your own account",
//       });
//     }

//     await user.deleteOne();

//     res.status(200).json({
//       success: true,
//       message: "User deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete user error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete user",
//     });
//   }
// };
