const express = require("express");
const router = express.Router();
const {
  uploadProfileImage,
  removeProfileImage,
  getProfileImage,
} = require("../controllers/ProfileImageController");
const { protect } = require("../middleware/Auth");
const { upload } = require("../config/cloudinary.config");

// Protected routes (authenticated users only)

// Upload/Update profile image
router.post(
  "/upload-image",
  protect,
  upload.single("profileImage"),
  uploadProfileImage,
);

// Remove profile image
router.delete("/remove-image", protect, removeProfileImage);

// Get current profile image
router.get("/image", protect, getProfileImage);

module.exports = router;
