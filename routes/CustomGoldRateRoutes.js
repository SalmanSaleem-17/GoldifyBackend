const express = require("express");
const router = express.Router();
const {
  getUserRate,
  updateUserRate,
  getShopRate,
  updateShopRate,
  getAllUserRates,
} = require("../controllers/CustomGoldRateController");

// Import authentication middleware
const { protect } = require("../middleware/Auth");

// All routes require authentication
router.use(protect);

// MAIN ENDPOINTS - Uses active shop automatically
router
  .route("/")
  .get(getUserRate) // GET rate for active shop
  .put(updateUserRate); // UPDATE rate for active shop (upsert)

// Get all rates for user's shops
router.get("/all", getAllUserRates);

// Shop-specific endpoints
router
  .route("/shop/:shopId")
  .get(getShopRate) // GET rate for specific shop
  .put(updateShopRate); // UPDATE rate for specific shop (upsert)

module.exports = router;
