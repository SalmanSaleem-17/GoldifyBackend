const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile,
  getAllUsers,
  updateUserRole,
  deleteUser,
  changeCountry,
  changePassword,
  googleCallback,
  completeProfile,
} = require("../controllers/AuthController");
const { protect, adminOnly } = require("../middleware/Auth");

// Public routes
router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:resetToken", resetPassword);
router.put("/change-password", protect, changePassword);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  googleCallback,
);

// Protected routes (all authenticated users)
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.post("/complete-profile", protect, completeProfile);

// Admin only routes
router.get("/users", protect, adminOnly, getAllUsers);
router.put("/users/:id/role", protect, adminOnly, updateUserRole);
router.delete("/users/:id", protect, adminOnly, deleteUser);
router.put("/change-country", protect, changeCountry);

module.exports = router;
