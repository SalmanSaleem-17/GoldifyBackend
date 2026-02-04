const Contact = require("../models/Contact");
const User = require("../models/User");

// Submit contact/feedback form
exports.createContact = async (req, res) => {
  try {
    const { subject, type, description } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!subject || !type || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide subject, type, and description",
      });
    }

    // Validate type
    const validTypes = ["Question", "Feedback", "New Feature Request"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid type. Must be Question, Feedback, or New Feature Request",
      });
    }

    // Validate description length
    if (description.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Description must be at least 10 characters",
      });
    }

    if (description.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description cannot exceed 1000 characters",
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create contact entry
    const contact = await Contact.create({
      userId,
      name: user.name,
      email: user.email,
      country: user.country,
      subject,
      type,
      description,
    });

    res.status(201).json({
      success: true,
      message:
        "Your message has been submitted successfully. We'll get back to you soon!",
      data: contact,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit contact form",
    });
  }
};

// Get all contacts for the logged-in user
exports.getUserContacts = async (req, res) => {
  try {
    const userId = req.user.id;

    const contacts = await Contact.find({ userId })
      .sort({ createdAt: -1 })
      .select("-__v");

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching user contacts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
    });
  }
};

// Get single contact by ID (user can only view their own)
exports.getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const contact = await Contact.findOne({ _id: id, userId });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact",
    });
  }
};

// Delete contact (user can only delete their own pending contacts)
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const contact = await Contact.findOne({ _id: id, userId });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    // Only allow deletion of pending contacts
    if (contact.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete contact that has been processed",
      });
    }

    await Contact.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact",
    });
  }
};

// Get contact statistics for user
exports.getContactStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Contact.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          closed: {
            $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
          },
          questions: {
            $sum: { $cond: [{ $eq: ["$type", "Question"] }, 1, 0] },
          },
          feedback: {
            $sum: { $cond: [{ $eq: ["$type", "Feedback"] }, 1, 0] },
          },
          featureRequests: {
            $sum: { $cond: [{ $eq: ["$type", "New Feature Request"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        questions: 0,
        feedback: 0,
        featureRequests: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching contact stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

// Admin: Get all contacts (add this to admin routes)
exports.getAllContacts = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const contacts = await Contact.find(query)
      .populate("userId", "name email shopName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      count: contacts.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching all contacts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
    });
  }
};

// Admin: Update contact status/response
exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, adminResponse } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminResponse) {
      updateData.adminResponse = adminResponse;
      updateData.respondedAt = Date.now();
      updateData.respondedBy = req.user.id;
    }

    const contact = await Contact.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact updated successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact",
    });
  }
};

module.exports = exports;
