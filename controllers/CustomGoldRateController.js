const CustomGoldRate = require("../models/CustomGoldRate");

// @desc    Get user's custom gold rate
// @route   GET /api/custom-gold-rate
// @access  Private
exports.getUserRate = async (req, res) => {
  try {
    const userId = req.user.id;
    const rate = await CustomGoldRate.getUserRate(userId);

    if (!rate) {
      return res.status(200).json({
        success: true,
        data: {
          country: req.user.country || "Pakistan",
          currency: "PKR",
          symbol: "Rs",
          ratePerTola: 0,
          ratePerGram: 0,
          ratePerOunce: 0,
          lastUpdated: null,
          updateCount: 0,
        },
        message: "No custom rate set yet",
      });
    }

    res.status(200).json({
      success: true,
      data: rate,
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

// @desc    Update user's custom gold rate
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

    // Get user's country and currency info from User model
    const country = req.user.country || "Pakistan";
    const currency = req.user.currency || "PKR";
    const symbol = req.user.currencySymbol || "Rs";

    // Create or update rate
    const rate = await CustomGoldRate.setUserRate(
      userId,
      country,
      currency,
      symbol,
      ratePerTola,
    );

    res.status(200).json({
      success: true,
      message: "Rate updated successfully",
      data: rate,
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

module.exports = exports;
