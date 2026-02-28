const Shop = require("../models/Shop");
const User = require("../models/User");
const { deleteImage, uploadBufferToCloudinary } = require("../config/cloudinary.config");
const { removeBackground } = require("@imgly/background-removal-node");

const DEFAULT_LOGO =
  "https://res.cloudinary.com/demo/image/upload/v1/default-shop-logo.png";

// Shared Cloudinary upload options for shop logos
const logoUploadOptions = (userId) => ({
  folder: "goldify/shop-logos",
  format: "png",
  resource_type: "image",
  transformation: [
    { width: 800, height: 800, crop: "limit" },
    { quality: "auto:best" },
  ],
  public_id: `shop_${userId}_${Date.now()}`,
});

// Remove background from image buffer then upload to Cloudinary as PNG.
// Falls back to uploading the original image if bg removal fails.
const processAndUploadLogo = async (buffer, mimetype, userId) => {
  const options = logoUploadOptions(userId);
  try {
    const inputBlob = new Blob([buffer], { type: mimetype });
    const pngBlob = await removeBackground(inputBlob);
    const pngBuffer = Buffer.from(await pngBlob.arrayBuffer());
    const result = await uploadBufferToCloudinary(pngBuffer, options);
    return result.secure_url;
  } catch (bgErr) {
    console.error("Background removal failed, uploading original:", bgErr.message);
    const result = await uploadBufferToCloudinary(buffer, options);
    return result.secure_url;
  }
};

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private
exports.createShop = async (req, res) => {
  let newLogoUrl = null; // track for rollback on DB error
  try {
    // Parse JSON strings from FormData
    let { shopName, contact, location } = req.body;

    // Parse contact and location if they're strings (from FormData)
    if (typeof contact === "string") {
      try {
        contact = JSON.parse(contact);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid contact data format",
        });
      }
    }

    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid location data format",
        });
      }
    }

    // Validate required fields
    if (!shopName || !contact || !location) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate contact structure
    if (!contact.countryCode || !contact.number || !contact.fullNumber) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information",
      });
    }

    // Validate location structure
    if (
      !location.country ||
      !location.countryCode ||
      !location.state ||
      !location.city ||
      !location.address
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid location information",
      });
    }

    // Get user's country to verify location
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Upload logo with background removal, or use default
    if (req.file && req.file.buffer) {
      newLogoUrl = await processAndUploadLogo(
        req.file.buffer,
        req.file.mimetype,
        req.user.id
      );
    }

    // Create shop
    const shop = await Shop.create({
      userId: req.user.id,
      shopName,
      contact: {
        countryCode: contact.countryCode,
        number: contact.number,
        fullNumber: contact.fullNumber,
      },
      shopLogo: newLogoUrl || DEFAULT_LOGO,
      location: {
        country: location.country,
        countryCode: location.countryCode,
        state: location.state,
        stateCode: location.stateCode || "",
        city: location.city,
        address: location.address,
        nearestPlace: location.nearestPlace || "",
      },
    });

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        contact: shop.contact,
        shopLogo: shop.shopLogo,
        location: shop.location,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
      },
    });
  } catch (error) {
    console.error("Create shop error:", error);
    if (newLogoUrl) await deleteImage(newLogoUrl);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create shop",
    });
  }
};

// @desc    Get all shops for logged-in user
// @route   GET /api/shops
// @access  Private
exports.getUserShops = async (req, res) => {
  try {
    const { active } = req.query;

    // Build filter
    const filter = { userId: req.user.id };

    // Filter by active status if provided
    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    const shops = await Shop.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: shops.length,
      shops: shops.map((shop) => ({
        id: shop._id,
        shopName: shop.shopName,
        contact: shop.contact,
        shopLogo: shop.shopLogo,
        location: shop.location,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get user shops error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shops",
    });
  }
};

// @desc    Get single shop by ID
// @route   GET /api/shops/:id
// @access  Private
exports.getShopById = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this shop",
      });
    }

    res.status(200).json({
      success: true,
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        contact: shop.contact,
        shopLogo: shop.shopLogo,
        location: shop.location,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get shop by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shop",
    });
  }
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private
exports.updateShop = async (req, res) => {
  let newLogoUrl = null; // track for rollback on DB error
  try {
    const { id } = req.params;
    let { shopName, contact, location, isActive } = req.body;

    // Parse contact and location if they're strings (from FormData)
    if (typeof contact === "string") {
      try {
        contact = JSON.parse(contact);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid contact data format",
        });
      }
    }

    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid location data format",
        });
      }
    }

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this shop",
      });
    }

    // Store old logo URL for deletion after successful save
    const oldLogoUrl = shop.shopLogo;

    // Update fields
    if (shopName) shop.shopName = shopName;
    if (isActive !== undefined) shop.isActive = isActive;

    // Upload new logo with background removal if provided
    if (req.file && req.file.buffer) {
      newLogoUrl = await processAndUploadLogo(
        req.file.buffer,
        req.file.mimetype,
        req.user.id
      );
      shop.shopLogo = newLogoUrl;
    }

    // Update contact if provided
    if (contact) {
      if (contact.countryCode) shop.contact.countryCode = contact.countryCode;
      if (contact.number) shop.contact.number = contact.number;
      if (contact.fullNumber) shop.contact.fullNumber = contact.fullNumber;
    }

    // Update location if provided
    if (location) {
      if (location.country) shop.location.country = location.country;
      if (location.countryCode)
        shop.location.countryCode = location.countryCode;
      if (location.state) shop.location.state = location.state;
      if (location.stateCode !== undefined)
        shop.location.stateCode = location.stateCode;
      if (location.city) shop.location.city = location.city;
      if (location.address) shop.location.address = location.address;
      if (location.nearestPlace !== undefined)
        shop.location.nearestPlace = location.nearestPlace;
    }

    await shop.save();
    newLogoUrl = null; // saved successfully — don't rollback

    // Delete old logo from Cloudinary now that save succeeded
    if (
      req.file &&
      oldLogoUrl &&
      oldLogoUrl.includes("cloudinary.com") &&
      !oldLogoUrl.includes("default-shop-logo")
    ) {
      await deleteImage(oldLogoUrl);
    }

    res.status(200).json({
      success: true,
      message: "Shop updated successfully",
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        contact: shop.contact,
        shopLogo: shop.shopLogo,
        location: shop.location,
        isActive: shop.isActive,
        updatedAt: shop.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update shop error:", error);
    if (newLogoUrl) await deleteImage(newLogoUrl);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update shop",
    });
  }
};

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private
exports.deleteShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this shop",
      });
    }

    // Delete shop logo from Cloudinary if it's not the default
    if (
      shop.shopLogo &&
      shop.shopLogo.includes("cloudinary.com") &&
      !shop.shopLogo.includes("default-shop-logo")
    ) {
      await deleteImage(shop.shopLogo);
    }

    await shop.deleteOne();

    res.status(200).json({
      success: true,
      message: "Shop deleted successfully",
    });
  } catch (error) {
    console.error("Delete shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete shop",
    });
  }
};

// @desc    Upload/Update shop logo only
// @route   POST /api/shops/:id/logo
// @access  Private
exports.updateShopLogo = async (req, res) => {
  let newLogoUrl = null; // track for rollback on DB error
  try {
    const { id } = req.params;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this shop",
      });
    }

    // Store old logo URL
    const oldLogoUrl = shop.shopLogo;

    // Upload new logo with background removal
    newLogoUrl = await processAndUploadLogo(
      req.file.buffer,
      req.file.mimetype,
      req.user.id
    );

    shop.shopLogo = newLogoUrl;
    await shop.save();
    newLogoUrl = null; // saved — don't rollback

    // Delete old logo from Cloudinary after successful save
    if (
      oldLogoUrl &&
      oldLogoUrl.includes("cloudinary.com") &&
      !oldLogoUrl.includes("default-shop-logo")
    ) {
      await deleteImage(oldLogoUrl);
    }

    res.status(200).json({
      success: true,
      message: "Shop logo updated successfully",
      shopLogo: shop.shopLogo,
    });
  } catch (error) {
    console.error("Update shop logo error:", error);
    if (newLogoUrl) await deleteImage(newLogoUrl);
    res.status(500).json({
      success: false,
      message: "Failed to update shop logo",
    });
  }
};

// @desc    Get all shops (Admin only)
// @route   GET /api/shops/admin/all
// @access  Private/Admin
exports.getAllShops = async (req, res) => {
  try {
    const { page = 1, limit = 10, active, search } = req.query;

    // Build filter
    const filter = {};

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    if (search) {
      filter.$or = [{ shopName: { $regex: search, $options: "i" } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .populate("userId", "name email country")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Shop.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: shops.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      shops: shops.map((shop) => ({
        id: shop._id,
        shopName: shop.shopName,
        contact: shop.contact,
        shopLogo: shop.shopLogo,
        location: shop.location,
        isActive: shop.isActive,
        user: shop.userId,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get all shops error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shops",
    });
  }
};

// @desc    Toggle shop active status (SINGLE ACTIVE SHOP)
// @route   PATCH /api/shops/:id/toggle-active
// @access  Private
exports.toggleShopActive = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Verify ownership
    if (shop.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this shop",
      });
    }

    const newActiveState = !shop.isActive;

    if (newActiveState) {
      // ACTIVATING this shop

      // Step 1: Deactivate ALL other shops for this user
      await Shop.updateMany(
        {
          userId: userId,
          _id: { $ne: id }, // Exclude current shop
        },
        { isActive: false },
      );

      // Step 2: Activate this shop
      shop.isActive = true;
      await shop.save();

      // Step 3: Update user's country to match active shop
      await User.findByIdAndUpdate(
        userId,
        { country: shop.location.country },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        message: `Shop activated successfully. All other shops deactivated.`,
        shop: {
          id: shop._id,
          shopName: shop.shopName,
          isActive: shop.isActive,
          country: shop.location.country,
        },
        userCountryUpdated: shop.location.country,
      });
    } else {
      // DEACTIVATING this shop
      shop.isActive = false;
      await shop.save();

      return res.status(200).json({
        success: true,
        message: `Shop deactivated successfully`,
        shop: {
          id: shop._id,
          shopName: shop.shopName,
          isActive: shop.isActive,
        },
        warning: "You have no active shops. Please activate one to continue.",
      });
    }
  } catch (error) {
    console.error("Toggle shop active error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle shop status",
    });
  }
};
