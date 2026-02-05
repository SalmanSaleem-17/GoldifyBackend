/**
 * Newsletter Routes
 * Routes for newsletter subscription management
 */

const express = require("express");
const router = express.Router();
const newsletterController = require("../controllers/NewsletterController");
const { protect, adminOnly } = require("../middleware/Auth");

/**
 * Public Routes
 */

// @route   POST /api/newsletter/subscribe
// @desc    Subscribe to newsletter
// @access  Public
router.post("/subscribe", newsletterController.subscribe);

// @route   POST /api/newsletter/unsubscribe
// @desc    Unsubscribe from newsletter
// @access  Public
router.post("/unsubscribe", newsletterController.unsubscribe);

/**
 * Protected Admin Routes
 */

// @route   GET /api/newsletter/stats
// @desc    Get newsletter statistics
// @access  Private/Admin
router.get("/stats", protect, adminOnly, newsletterController.getStats);

// @route   GET /api/newsletter/subscribers
// @desc    Get all newsletter subscribers
// @access  Private/Admin
router.get(
  "/subscribers",
  protect,
  adminOnly,
  newsletterController.getSubscribers,
);

// @route   DELETE /api/newsletter/subscribers/:id
// @desc    Delete a subscriber
// @access  Private/Admin
router.delete(
  "/subscribers/:id",
  protect,
  adminOnly,
  newsletterController.deleteSubscriber,
);

module.exports = router;
