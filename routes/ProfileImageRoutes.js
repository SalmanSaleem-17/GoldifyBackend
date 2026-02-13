const express = require("express");
const router = express.Router();
const {
  uploadProfileImage,
  removeProfileImage,
  getProfileImage,
} = require("../controllers/ProfileImageController");
const { protect } = require("../middleware/Auth");
const { uploadProfile } = require("../config/cloudinary.config"); // ✅ Changed from 'upload' to 'uploadProfile'

// Protected routes (authenticated users only)

// Upload/Update profile image
router.post(
  "/upload-image",
  protect,
  uploadProfile.single("profileImage"), // ✅ Changed from 'upload' to 'uploadProfile'
  uploadProfileImage,
);

// Remove profile image
router.delete("/remove-image", protect, removeProfileImage);

// Get current profile image
router.get("/image", protect, getProfileImage);

module.exports = router;
