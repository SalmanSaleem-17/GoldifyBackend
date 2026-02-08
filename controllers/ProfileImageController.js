const User = require("../models/User");
const { deleteImage } = require("../config/cloudinary.config");

// @desc    Upload/Update profile image
// @route   POST /api/profile/upload-image
// @access  Private
exports.uploadProfileImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old image from Cloudinary if exists and not default
    const defaultImageUrl = "https://www.svgrepo.com/show/5125/avatar.svg";
    if (user.profileImage && user.profileImage !== defaultImageUrl) {
      await deleteImage(user.profileImage);
    }

    // Update user with new Cloudinary image URL
    user.profileImage = req.file.path; // Cloudinary secure URL
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      imageUrl: user.profileImage,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile image",
    });
  }
};

// @desc    Remove profile image (set to default)
// @route   DELETE /api/profile/remove-image
// @access  Private
exports.removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const defaultImageUrl = "https://www.svgrepo.com/show/5125/avatar.svg";

    // Delete current image from Cloudinary if not default
    if (user.profileImage && user.profileImage !== defaultImageUrl) {
      await deleteImage(user.profileImage);
    }

    // Set to default image
    user.profileImage = defaultImageUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image removed successfully",
      imageUrl: user.profileImage,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        country: user.country,
        shopName: user.shopName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Remove profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove profile image",
    });
  }
};

// @desc    Get current profile image
// @route   GET /api/profile/image
// @access  Private
exports.getProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      imageUrl: user.profileImage,
    });
  } catch (error) {
    console.error("Get profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile image",
    });
  }
};
