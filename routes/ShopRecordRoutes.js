const express = require("express");
const router = express.Router();
const {
  getTodayRecord,
  getRecordByDate,
  addTransaction,
  deleteTransaction,
  clearTodayRecord,
  getRecordsInRange,
  getMonthlySummary,
  getRecentRecords,
  getStatistics,
  updateTransaction,
} = require("../controllers/ShopRecordController");

// Import authentication middleware
// Adjust the path based on your project structure
const { protect } = require("../middleware/Auth");

// All routes require authentication
router.use(protect);

// Today's record routes
router.get("/today", getTodayRecord);
router.delete("/clear", clearTodayRecord);

// Transaction management
router.post("/transaction", addTransaction);
router.put("/transaction/:transactionId", updateTransaction);
router.delete("/transaction/:transactionId", deleteTransaction);

// Historical data routes
router.get("/date/:dateString", getRecordByDate);
router.get("/range", getRecordsInRange);
router.get("/recent", getRecentRecords);

// Summary and statistics
router.get("/monthly/:year/:month", getMonthlySummary);
router.get("/statistics", getStatistics);

module.exports = router;
