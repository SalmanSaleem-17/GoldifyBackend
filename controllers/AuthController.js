const User = require("../models/User");
const Shop = require("../models/Shop");
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
    const { name, email, country, password } = req.body;
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

// @desc    Update user profile WITH SHOP COUNTRY SYNC
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, country } = req.body;

    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let shopChanges = null;

    // Check if country is being changed
    if (country && country !== user.country) {
      console.log(`Country changing from ${user.country} to ${country}`);

      // STEP 1: Deactivate ALL current active shops
      await Shop.updateMany(
        {
          userId: req.user.id,
          isActive: true,
        },
        { isActive: false },
      );

      console.log("All shops deactivated");

      // Get the previously active shop name for the message
      const previousActiveShop = await Shop.findOne({
        userId: req.user.id,
        isActive: false,
        "location.country": user.country,
      })
        .sort({ updatedAt: -1 })
        .limit(1);

      // STEP 2: Find a shop in the new country
      const shopInNewCountry = await Shop.findOne({
        userId: req.user.id,
        "location.country": country,
      }).sort({ createdAt: 1 }); // Get the first created shop

      console.log(
        "Shop in new country:",
        shopInNewCountry ? shopInNewCountry.shopName : "Not found",
      );

      if (shopInNewCountry) {
        // STEP 3: Activate the found shop
        shopInNewCountry.isActive = true;
        await shopInNewCountry.save();

        console.log(`Activated shop: ${shopInNewCountry.shopName}`);

        shopChanges = {
          deactivated: previousActiveShop ? previousActiveShop.shopName : null,
          activated: shopInNewCountry.shopName,
          activatedShopId: shopInNewCountry._id.toString(),
          message: `Active shop changed to "${shopInNewCountry.shopName}" (${country})`,
        };
      } else {
        // No shop found in new country
        console.log(`No shop found in ${country}`);

        shopChanges = {
          deactivated: previousActiveShop ? previousActiveShop.shopName : null,
          activated: null,
          warning: `No shops found in ${country}. Please create or activate a shop in your new country.`,
        };
      }
    }

    // Update user fields
    if (name) user.name = name;
    if (country) user.country = country;

    await user.save();

    console.log("User profile updated successfully");

    res.status(200).json({
      success: true,
      message: shopChanges
        ? shopChanges.message || "Profile updated with shop changes"
        : "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        role: user.role,
        profileImage: user.profileImage,
      },
      shopChanges,
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

// @desc    Change user country
// @route   PUT /api/auth/change-country
// @access  Private
exports.changeCountry = async (req, res) => {
  try {
    const { country } = req.body;

    if (!country || !country.trim()) {
      return res.status(400).json({
        success: false,
        message: "Country is required",
      });
    }

    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If country hasn't changed, just return success
    if (user.country === country) {
      return res.status(200).json({
        success: true,
        message: "Country unchanged",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          country: user.country,
          role: user.role,
        },
      });
    }

    console.log(`Changing country from ${user.country} to ${country}`);

    // STEP 1: Deactivate ALL shops
    await Shop.updateMany(
      {
        userId: req.user.id,
        isActive: true,
      },
      { isActive: false },
    );

    // STEP 2: Find and activate shop in new country
    const shopInNewCountry = await Shop.findOne({
      userId: req.user.id,
      "location.country": country,
    }).sort({ createdAt: 1 });

    let message = "Country updated successfully";
    let shopChanges = null;

    if (shopInNewCountry) {
      shopInNewCountry.isActive = true;
      await shopInNewCountry.save();

      message = `Country updated. Active shop changed to "${shopInNewCountry.shopName}"`;
      shopChanges = {
        activated: shopInNewCountry.shopName,
        activatedShopId: shopInNewCountry._id.toString(),
      };
    } else {
      message = `Country updated. No shops found in ${country}. Please create or activate a shop.`;
      shopChanges = {
        activated: null,
        warning: `No shops found in ${country}. Please create one.`,
      };
    }

    // Update user country
    user.country = country;
    await user.save();

    return res.status(200).json({
      success: true,
      message,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        role: user.role,
      },
      shopChanges,
    });
  } catch (error) {
    console.error("Change country error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change country",
    });
  }
};

module.exports = exports;
