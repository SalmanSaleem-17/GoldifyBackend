const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/Auth");
const {
  createSale, getAllSales, getSaleById, updateSale, deleteSale,
  getSalesStatistics, addPayment, markAsPaid, addGoldReturn,
  markAsDelivered, getPendingPayments, getTotalArrears,
} = require("../controllers/JewelrySaleController");

router.use(protect);

router.route("/").get(getAllSales).post(createSale);
router.get("/statistics", getSalesStatistics);
router.get("/pending-payments", getPendingPayments);
router.get("/total-arrears", getTotalArrears);

router.route("/:id").get(getSaleById).put(updateSale).delete(deleteSale);
router.post("/:id/payment", addPayment);
router.post("/:id/mark-paid", markAsPaid);
router.post("/:id/gold-return", addGoldReturn);
router.patch("/:id/deliver", markAsDelivered);

module.exports = router;
