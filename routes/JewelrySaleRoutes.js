const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/Auth"); // Adjust path as needed
const {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getSalesStatistics,
  addPayment,
  addGoldReturn,
  markAsDelivered,
  getPendingPayments,
  getTotalArrears,
} = require("../controllers/JewelrySaleController");

// Apply protect middleware to all routes
router.use(protect);

// Sales routes
router.route("/").get(getAllSales).post(createSale);

router.get("/statistics", getSalesStatistics);
router.get("/pending-payments", getPendingPayments);
router.get("/total-arrears", getTotalArrears);

router.route("/:id").get(getSaleById).put(updateSale).delete(deleteSale);

router.post("/:id/payment", addPayment);
router.post("/:id/gold-return", addGoldReturn);
router.patch("/:id/deliver", markAsDelivered);

module.exports = router;
