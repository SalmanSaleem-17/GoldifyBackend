const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/Auth");
const {
  createContact,
  getUserContacts,
  getContactById,
  deleteContact,
  getContactStats,
  getAllContacts,
  updateContact,
} = require("../controllers/ContactController");

// User routes
router.post("/", protect, createContact);
router.get("/my-contacts", protect, getUserContacts);
router.get("/stats", protect, getContactStats);

// Admin routes — must be defined BEFORE /:id to avoid the wildcard catching them
router.get("/admin/all", protect, adminOnly, getAllContacts);
router.patch("/admin/:id", protect, adminOnly, updateContact);

// Parameterised user routes — keep these last
router.get("/:id", protect, getContactById);
router.delete("/:id", protect, deleteContact);

module.exports = router;
