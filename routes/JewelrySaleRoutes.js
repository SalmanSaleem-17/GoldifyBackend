const express = require("express");
const router = express.Router();
const auth = require("../middleware/Auth");
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

// @route   POST /api/jewelry-sales
// @desc    Create a new jewelry sale
// @access  Private
router.post("/", auth, createSale);

// @route   GET /api/jewelry-sales
// @desc    Get all sales for authenticated user
// @access  Private
router.get("/", auth, getAllSales);

// @route   GET /api/jewelry-sales/statistics
// @desc    Get sales statistics
// @access  Private
router.get("/statistics", auth, getSalesStatistics);

// @route   GET /api/jewelry-sales/pending-payments
// @desc    Get all sales with pending payments
// @access  Private
router.get("/pending-payments", auth, getPendingPayments);

// @route   GET /api/jewelry-sales/total-arrears
// @desc    Get total arrears amount
// @access  Private
router.get("/total-arrears", auth, getTotalArrears);

// @route   GET /api/jewelry-sales/:id
// @desc    Get single sale by ID
// @access  Private
router.get("/:id", auth, getSaleById);

// @route   PUT /api/jewelry-sales/:id
// @desc    Update sale
// @access  Private
router.put("/:id", auth, updateSale);

// @route   POST /api/jewelry-sales/:id/payment
// @desc    Add payment to sale
// @access  Private
router.post("/:id/payment", auth, addPayment);

// @route   POST /api/jewelry-sales/:id/gold-return
// @desc    Add gold return to sale
// @access  Private
router.post("/:id/gold-return", auth, addGoldReturn);

// @route   PUT /api/jewelry-sales/:id/deliver
// @desc    Mark sale as delivered
// @access  Private
router.put("/:id/deliver", auth, markAsDelivered);

// @route   DELETE /api/jewelry-sales/:id
// @desc    Delete sale
// @access  Private
router.delete("/:id", auth, deleteSale);

module.exports = router;
