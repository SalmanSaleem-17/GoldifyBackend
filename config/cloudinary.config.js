const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage for Profile Images
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "goldify/profile-images",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto:good" },
      { fetch_format: "auto" },
    ],
    public_id: (req, file) => {
      const userId = req.user?.id || "temp";
      const timestamp = Date.now();
      return `user_${userId}_${timestamp}`;
    },
  },
});

// Configure Cloudinary Storage for Shop Logos
const shopLogoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "goldify/shop-logos",
    allowed_formats: ["png"], // PNG only to preserve transparency
    format: "png",            // Force PNG output — keeps transparent background
    transformation: [
      { width: 800, height: 800, crop: "limit" },
      { quality: "auto:best" },
    ],
    public_id: (req, file) => {
      const userId = req.user?.id || "temp";
      const timestamp = Date.now();
      return `shop_${userId}_${timestamp}`;
    },
  },
});

// Multer upload configuration for profile images
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Multer upload configuration for shop logos
const uploadShopLogo = multer({
  storage: shopLogoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size for logos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Memory storage for shop logos — file stays in memory so we can process it
// (remove background) before uploading to Cloudinary
const shopLogoMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed!"), false);
  },
});

// Upload a raw Buffer to Cloudinary with the given options
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      })
      .end(buffer);
  });

// Delete image from Cloudinary
const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
      return null;
    }

    // Extract public_id from URL: everything after /upload/, strip version prefix and extension
    // e.g. https://res.cloudinary.com/CLOUD/image/upload/v1234/goldify/shop-logos/shop_X.png
    //   → public_id = "goldify/shop-logos/shop_X"
    const uploadIndex = imageUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let publicIdWithExt = imageUrl.substring(uploadIndex + 8);
    // Strip optional version segment (v1234567/)
    publicIdWithExt = publicIdWithExt.replace(/^v\d+\//, "");
    // Strip file extension
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return null;
  }
};

// Delete multiple images (for cleanup)
const deleteMultipleImages = async (imageUrls) => {
  try {
    const deletePromises = imageUrls.map((url) => deleteImage(url));
    const results = await Promise.all(deletePromises);
    return results;
  } catch (error) {
    console.error("Error deleting multiple images:", error);
    return null;
  }
};

// Get all images in a folder (for admin cleanup)
const listFolderImages = async (folderPath = "goldify/profile-images") => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: folderPath,
      max_results: 500,
    });
    return result.resources;
  } catch (error) {
    console.error("Error listing folder images:", error);
    return [];
  }
};

// Delete old/unused images (cleanup utility)
const cleanupOldImages = async (
  daysOld = 30,
  folderPath = "goldify/profile-images",
) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const resources = await listFolderImages(folderPath);
    const oldImages = resources.filter((resource) => {
      const createdAt = new Date(resource.created_at);
      return createdAt < cutoffDate;
    });

    if (oldImages.length === 0) {
      return { deleted: 0, message: "No old images to delete" };
    }

    const publicIds = oldImages.map((img) => img.public_id);
    const result = await cloudinary.api.delete_resources(publicIds);

    return {
      deleted: Object.keys(result.deleted).length,
      message: `Deleted ${Object.keys(result.deleted).length} images older than ${daysOld} days`,
    };
  } catch (error) {
    console.error("Error cleaning up old images:", error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadProfile,
  uploadShopLogo,
  shopLogoMemoryUpload,
  uploadBufferToCloudinary,
  deleteImage,
  deleteMultipleImages,
  listFolderImages,
  cleanupOldImages,
};

// //config/cloudinary.config.js
// const cloudinary = require("cloudinary").v2;
// const { CloudinaryStorage } = require("multer-storage-cloudinary");
// const multer = require("multer");

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // Configure Cloudinary Storage for Multer
// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: "goldify/profile-images",
//     allowed_formats: ["jpg", "jpeg", "png", "webp"],
//     transformation: [
//       { width: 500, height: 500, crop: "limit" }, // Limit size to save space
//       { quality: "auto:good" }, // Automatic quality optimization
//       { fetch_format: "auto" }, // Auto format (WebP when supported)
//     ],
//     public_id: (req, file) => {
//       // Create unique filename: userId_timestamp
//       const userId = req.user?.id || "temp";
//       const timestamp = Date.now();
//       return `user_${userId}_${timestamp}`;
//     },
//   },
// });

// // Multer upload configuration with file size limit
// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB max file size
//   },
//   fileFilter: (req, file, cb) => {
//     // Check file type
//     if (file.mimetype.startsWith("image/")) {
//       cb(null, true);
//     } else {
//       cb(new Error("Only image files are allowed!"), false);
//     }
//   },
// });

// // Delete image from Cloudinary
// const deleteImage = async (imageUrl) => {
//   try {
//     // Extract public_id from Cloudinary URL
//     // URL format: https://res.cloudinary.com/CLOUD_NAME/image/upload/v1234567/folder/public_id.ext
//     if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
//       return null;
//     }

//     const parts = imageUrl.split("/");
//     const fileName = parts[parts.length - 1].split(".")[0]; // Get filename without extension
//     const folder = parts[parts.length - 2]; // Get folder name
//     const publicId = `${folder}/${fileName}`;

//     const result = await cloudinary.uploader.destroy(publicId);
//     return result;
//   } catch (error) {
//     console.error("Error deleting image from Cloudinary:", error);
//     return null;
//   }
// };

// // Delete multiple images (for cleanup)
// const deleteMultipleImages = async (imageUrls) => {
//   try {
//     const deletePromises = imageUrls.map((url) => deleteImage(url));
//     const results = await Promise.all(deletePromises);
//     return results;
//   } catch (error) {
//     console.error("Error deleting multiple images:", error);
//     return null;
//   }
// };

// // Get all images in a folder (for admin cleanup)
// const listFolderImages = async (folderPath = "goldify/profile-images") => {
//   try {
//     const result = await cloudinary.api.resources({
//       type: "upload",
//       prefix: folderPath,
//       max_results: 500,
//     });
//     return result.resources;
//   } catch (error) {
//     console.error("Error listing folder images:", error);
//     return [];
//   }
// };

// // Delete old/unused images (cleanup utility)
// const cleanupOldImages = async (daysOld = 30) => {
//   try {
//     const cutoffDate = new Date();
//     cutoffDate.setDate(cutoffDate.getDate() - daysOld);

//     const resources = await listFolderImages();
//     const oldImages = resources.filter((resource) => {
//       const createdAt = new Date(resource.created_at);
//       return createdAt < cutoffDate;
//     });

//     if (oldImages.length === 0) {
//       return { deleted: 0, message: "No old images to delete" };
//     }

//     const publicIds = oldImages.map((img) => img.public_id);
//     const result = await cloudinary.api.delete_resources(publicIds);

//     return {
//       deleted: Object.keys(result.deleted).length,
//       message: `Deleted ${Object.keys(result.deleted).length} images older than ${daysOld} days`,
//     };
//   } catch (error) {
//     console.error("Error cleaning up old images:", error);
//     throw error;
//   }
// };

// module.exports = {
//   cloudinary,
//   upload,
//   deleteImage,
//   deleteMultipleImages,
//   listFolderImages,
//   cleanupOldImages,
// };
