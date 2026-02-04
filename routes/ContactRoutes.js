const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/Auth");
const {
  createContact,
  getUserContacts,
  getContactById,
  deleteContact,
  getContactStats,
  getAllContacts,
  updateContact,
} = require("../controllers/ContactController");

// User routes (require authentication)
router.post("/", protect, createContact);
router.get("/my-contacts", protect, getUserContacts);
router.get("/stats", protect, getContactStats);
router.get("/:id", protect, getContactById);
router.delete("/:id", protect, deleteContact);

// Admin routes (add admin middleware if needed)
// router.get("/admin/all", protect, adminOnly, getAllContacts);
// router.patch("/admin/:id", protect, adminOnly, updateContact);

module.exports = router;
