const express = require("express");
const router = express.Router();
const {
  getLatestRates,
  getRateByCountry,
  getAvailableCountries,
  refreshRates,
  getRateHistory,
  cleanupOldRates,
} = require("../controllers/GoldrateController");
const { protect, adminOnly } = require("../middleware/Auth");

// Public routes
router.get("/latest", getLatestRates);
router.get("/country/:currency", getRateByCountry);
router.get("/countries", getAvailableCountries);
router.get("/history", getRateHistory);

// Protected routes (Admin only)
router.post("/refresh", refreshRates);
router.delete("/cleanup", protect, adminOnly, async (req, res) => {
  try {
    const deletedCount = await cleanupOldRates();
    res.json({
      success: true,
      message: `Removed ${deletedCount} records older than 7 days`,
      deletedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
