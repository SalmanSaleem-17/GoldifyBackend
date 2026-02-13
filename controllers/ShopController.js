const Shop = require("../models/Shop");
const User = require("../models/User");
const { deleteImage } = require("../config/cloudinary.config");

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private
exports.createShop = async (req, res) => {
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

    // Get shop logo from uploaded file or use default
    const shopLogo = req.file
      ? req.file.path
      : "https://res.cloudinary.com/demo/image/upload/v1/default-shop-logo.png";

    // Create shop
    const shop = await Shop.create({
      userId: req.user.id,
      shopName,
      contact: {
        countryCode: contact.countryCode,
        number: contact.number,
        fullNumber: contact.fullNumber,
      },
      shopLogo,
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

    // Delete uploaded image if shop creation fails
    if (req.file && req.file.path) {
      await deleteImage(req.file.path);
    }

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
      // Delete uploaded image if shop not found
      if (req.file && req.file.path) {
        await deleteImage(req.file.path);
      }

      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      // Delete uploaded image if not authorized
      if (req.file && req.file.path) {
        await deleteImage(req.file.path);
      }

      return res.status(403).json({
        success: false,
        message: "Not authorized to update this shop",
      });
    }

    // Store old logo URL for deletion if being replaced
    const oldLogoUrl = shop.shopLogo;

    // Update fields
    if (shopName) shop.shopName = shopName;
    if (isActive !== undefined) shop.isActive = isActive;

    // Update shop logo if new file uploaded
    if (req.file && req.file.path) {
      shop.shopLogo = req.file.path;

      // Delete old logo from Cloudinary if it's not the default
      if (
        oldLogoUrl &&
        oldLogoUrl.includes("cloudinary.com") &&
        !oldLogoUrl.includes("default-shop-logo")
      ) {
        await deleteImage(oldLogoUrl);
      }
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

    // Delete uploaded image if update fails
    if (req.file && req.file.path) {
      await deleteImage(req.file.path);
    }

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
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const shop = await Shop.findById(id);

    if (!shop) {
      // Delete uploaded image if shop not found
      await deleteImage(req.file.path);

      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check if user owns this shop
    if (shop.userId.toString() !== req.user.id) {
      // Delete uploaded image if not authorized
      await deleteImage(req.file.path);

      return res.status(403).json({
        success: false,
        message: "Not authorized to update this shop",
      });
    }

    // Store old logo URL
    const oldLogoUrl = shop.shopLogo;

    // Update shop logo
    shop.shopLogo = req.file.path;
    await shop.save();

    // Delete old logo from Cloudinary if it's not the default
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

    // Delete uploaded image if update fails
    if (req.file && req.file.path) {
      await deleteImage(req.file.path);
    }

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
