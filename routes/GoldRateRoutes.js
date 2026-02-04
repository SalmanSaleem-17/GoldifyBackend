const express = require("express");
const router = express.Router();
const {
  getLatestRates,
  getRateByCountry,
  getAvailableCountries,
  refreshRates,
  getRateHistory,
} = require("../controllers/GoldrateController");
const { protect, authorize } = require("../middleware/Auth");

// Public routes
router.get("/latest", getLatestRates);
router.get("/country/:currency", getRateByCountry);
router.get("/countries", getAvailableCountries);
router.get("/history", getRateHistory);

// Protected routes (Admin only)
router.post("/refresh", refreshRates);

module.exports = router;
