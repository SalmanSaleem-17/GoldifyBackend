const CustomGoldRate = require("../models/CustomGoldRate");
const Shop = require("../models/Shop");
const { FIXED_DEFAULT_SHOP_ID } = require("../utils/constants");
const { getCurrencyByCountry } = require("../utils/CurrencyCountries");

/**
 * SHOP DETECTION STRATEGY:
 * Case 1: User WITH shop(s) → Use active shop ID
 * Case 2: User WITHOUT shop → Use FIXED DEFAULT SHOP ID
 * Case 3: NOT logged in → Frontend handles with localStorage
 */

/**
 * Get currency info based on country
 */
const getCurrencyInfo = (country) => {
  const currencyData = getCurrencyByCountry(country);
  return {
    currency: currencyData.currencySign,
    symbol: currencyData.symbol,
  };
};

/**
 * Get the default shared shop
 */
const getDefaultShop = async () => {
  const defaultShop = await Shop.findById(FIXED_DEFAULT_SHOP_ID);

  if (!defaultShop) {
    throw new Error(`Default shop not found! Please run: npm run setup:shop`);
  }

  return defaultShop;
};

/**
 * Smart shop detection
 */
const getShopForUser = async (userId) => {
  // Check if user has any shops
  const userShopCount = await Shop.countDocuments({ userId });

  if (userShopCount === 0) {
    // No shops → Use default
    const defaultShop = await getDefaultShop();
    console.log(`✓ User has no shops, using default`);
    return {
      shop: defaultShop,
      isUsingDefaultShop: true,
    };
  }

  // User has shops → Find active
  let activeShop = await Shop.findOne({ userId, isActive: true });

  if (activeShop) {
    console.log(`✓ Active shop: ${activeShop.shopName}`);
    return {
      shop: activeShop,
      isUsingDefaultShop: false,
    };
  }

  // No active shop → Activate first shop
  activeShop = await Shop.findOne({ userId });

  if (activeShop) {
    activeShop.isActive = true;
    await activeShop.save();
    console.log(`✓ Activated: ${activeShop.shopName}`);
    return {
      shop: activeShop,
      isUsingDefaultShop: false,
    };
  }

  throw new Error("Shop count mismatch");
};

// @desc    Get user's custom gold rate
// @route   GET /api/custom-gold-rate
// @access  Private
exports.getUserRate = async (req, res) => {
  try {
    const userId = req.user.id;

    // Smart shop detection
    const { shop, isUsingDefaultShop } = await getShopForUser(userId);

    // Get rate for the shop
    const rate = await CustomGoldRate.findOne({ userId, shopId: shop._id });

    if (!rate) {
      // No rate set yet
      const country = isUsingDefaultShop
        ? req.user.country || "Pakistan"
        : shop.location.country;

      const currencyInfo = getCurrencyInfo(country);

      return res.status(200).json({
        success: true,
        data: {
          shopId: shop._id,
          shopName: shop.shopName,
          isDefaultShop: isUsingDefaultShop,
          country,
          currency: currencyInfo.currency,
          symbol: currencyInfo.symbol,
          ratePerTola: 0,
          ratePerGram: 0,
          ratePerOunce: 0,
          lastUpdated: null,
          updateCount: 0,
        },
        message: "No custom rate set yet.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...rate.toObject(),
        shopName: shop.shopName,
        isDefaultShop: isUsingDefaultShop,
      },
    });
  } catch (error) {
    console.error("Get user rate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get custom rate",
      error: error.message,
    });
  }
};

// @desc    Update user's custom gold rate (UPSERT - always updates)
// @route   PUT /api/custom-gold-rate
// @access  Private
exports.updateUserRate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ratePerTola } = req.body;

    // Validation
    if (ratePerTola === undefined || ratePerTola < 0) {
      return res.status(400).json({
        success: false,
        message: "Rate must be a positive number",
      });
    }

    // Smart shop detection
    const { shop, isUsingDefaultShop } = await getShopForUser(userId);

    // Get currency info
    const country = isUsingDefaultShop
      ? req.user.country || "Pakistan"
      : shop.location.country;

    const currencyInfo = getCurrencyInfo(country);

    // UPSERT: Update if exists, create if not
    const rate = await CustomGoldRate.setShopRate(
      userId,
      shop._id,
      country,
      currencyInfo.currency,
      currencyInfo.symbol,
      ratePerTola,
    );

    res.status(200).json({
      success: true,
      message: "Rate updated successfully",
      data: {
        ...rate.toObject(),
        shopName: shop.shopName,
        isDefaultShop: isUsingDefaultShop,
      },
    });
  } catch (error) {
    console.error("Update user rate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update custom rate",
      error: error.message,
    });
  }
};

// @desc    Get rate for a specific shop
// @route   GET /api/custom-gold-rate/shop/:shopId
// @access  Private
exports.getShopRate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shopId } = req.params;

    // Verify shop
    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check permissions
    const isDefaultShop = shop._id.toString() === FIXED_DEFAULT_SHOP_ID;
    const isUserShop =
      shop.userId && shop.userId.toString() === userId.toString();

    if (!isDefaultShop && !isUserShop) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get rate
    const rate = await CustomGoldRate.getShopRate(userId, shopId);

    if (!rate) {
      const currencyInfo = getCurrencyInfo(shop.location.country);

      return res.status(200).json({
        success: true,
        data: {
          shopId: shop._id,
          shopName: shop.shopName,
          isDefaultShop,
          country: shop.location.country,
          currency: currencyInfo.currency,
          symbol: currencyInfo.symbol,
          ratePerTola: 0,
          ratePerGram: 0,
          ratePerOunce: 0,
          lastUpdated: null,
          updateCount: 0,
        },
        message: "No rate set yet",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...rate.toObject(),
        shopName: shop.shopName,
        isDefaultShop,
      },
    });
  } catch (error) {
    console.error("Get shop rate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shop rate",
      error: error.message,
    });
  }
};

// @desc    Update rate for a specific shop (UPSERT)
// @route   PUT /api/custom-gold-rate/shop/:shopId
// @access  Private
exports.updateShopRate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shopId } = req.params;
    const { ratePerTola } = req.body;

    // Validation
    if (ratePerTola === undefined || ratePerTola < 0) {
      return res.status(400).json({
        success: false,
        message: "Rate must be a positive number",
      });
    }

    // Verify shop
    const shop = await Shop.findById(shopId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Check permissions
    const isDefaultShop = shop._id.toString() === FIXED_DEFAULT_SHOP_ID;
    const isUserShop =
      shop.userId && shop.userId.toString() === userId.toString();

    if (!isDefaultShop && !isUserShop) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get currency info
    const currencyInfo = getCurrencyInfo(shop.location.country);

    // UPSERT: Update if exists, create if not
    const rate = await CustomGoldRate.setShopRate(
      userId,
      shopId,
      shop.location.country,
      currencyInfo.currency,
      currencyInfo.symbol,
      ratePerTola,
    );

    res.status(200).json({
      success: true,
      message: "Rate updated successfully",
      data: {
        ...rate.toObject(),
        shopName: shop.shopName,
        isDefaultShop,
      },
    });
  } catch (error) {
    console.error("Update shop rate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shop rate",
      error: error.message,
    });
  }
};

// @desc    Get all rates for user's shops
// @route   GET /api/custom-gold-rate/all
// @access  Private
exports.getAllUserRates = async (req, res) => {
  try {
    const userId = req.user.id;

    const rates = await CustomGoldRate.getUserRates(userId);

    res.status(200).json({
      success: true,
      count: rates.length,
      data: rates.map((rate) => ({
        ...rate.toObject(),
        isDefaultShop: rate.shopId._id.toString() === FIXED_DEFAULT_SHOP_ID,
      })),
    });
  } catch (error) {
    console.error("Get all rates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get rates",
      error: error.message,
    });
  }
};

module.exports = exports;
