const express = require("express");
const router = express.Router();
const {
  getUserRate,
  updateUserRate,
} = require("../controllers/CustomGoldRateController");

// Import authentication middleware
const { protect } = require("../middleware/Auth");

// All routes require authentication
router.use(protect);

// Get and update user's custom rate
router.route("/").get(getUserRate).put(updateUserRate);

module.exports = router;
