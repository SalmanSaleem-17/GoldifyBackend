const JewelrySale = require("../models/JewelrySale");

// Create a new jewelry sale
const createSale = async (req, res) => {
  try {
    const userId = req.user._id;

    const saleData = {
      ...req.body,
      userId,
      currentPayment: req.body.advancePayment || 0,
    };

    // Set initial final calculations
    if (saleData.calculations) {
      saleData.calculations.finalCustomerPayment = saleData.currentPayment;
      saleData.calculations.finalCustomerGoldWeight =
        saleData.customerGold || 0;
      saleData.calculations.arrears = saleData.calculations.remainingBalance;
    }

    // Set payment status based on balance
    if (saleData.calculations && saleData.calculations.remainingBalance <= 0) {
      saleData.paymentStatus =
        saleData.calculations.remainingBalance < 0 ? "overpaid" : "paid";
    } else if (saleData.currentPayment > 0) {
      saleData.paymentStatus = "partial";
    } else {
      saleData.paymentStatus = "pending";
    }

    // Add initial payment to history if advance payment exists
    if (saleData.currentPayment > 0) {
      saleData.paymentHistory = [
        {
          amount: saleData.currentPayment,
          method: "cash",
          note: "Initial advance payment",
        },
      ];
    }

    const sale = new JewelrySale(saleData);
    await sale.save();

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message,
    });
  }
};

// Get all sales for a user
const getAllSales = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      customerName,
      paymentStatus,
      deliveryStatus,
    } = req.query;

    // Build query
    const query = { userId };

    // Date filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Customer name filter
    if (customerName) {
      query.customerName = { $regex: customerName, $options: "i" };
    }

    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Delivery status filter
    if (deliveryStatus) {
      query.deliveryStatus = deliveryStatus;
    }

    const sales = await JewelrySale.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await JewelrySale.countDocuments(query);

    res.status(200).json({
      success: true,
      data: sales,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
      error: error.message,
    });
  }
};

// Get single sale by ID
const getSaleById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const sale = await JewelrySale.findOne({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error("Error fetching sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale",
      error: error.message,
    });
  }
};

// Update sale
const updateSale = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const sale = await JewelrySale.findOne({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (
        key !== "_id" &&
        key !== "userId" &&
        key !== "paymentHistory" &&
        key !== "goldReturnHistory"
      ) {
        sale[key] = req.body[key];
      }
    });

    await sale.save();

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error updating sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sale",
      error: error.message,
    });
  }
};

// Delete sale
const deleteSale = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const sale = await JewelrySale.findOneAndDelete({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sale:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sale",
      error: error.message,
    });
  }
};

// Get sales statistics
const getSalesStatistics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    // Build query
    const query = { userId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const sales = await JewelrySale.find(query);

    // Calculate statistics
    const stats = {
      totalSales: sales.length,
      totalRevenue: sales.reduce(
        (sum, sale) => sum + sale.calculations.totalPrice,
        0,
      ),
      totalBalance: sales.reduce(
        (sum, sale) => sum + sale.calculations.remainingBalance,
        0,
      ),
      totalArrears: sales.reduce(
        (sum, sale) => sum + (sale.calculations.arrears || 0),
        0,
      ),
      totalAdvance: sales.reduce((sum, sale) => sum + sale.advancePayment, 0),
      totalPayments: sales.reduce((sum, sale) => sum + sale.currentPayment, 0),
      totalGoldWeight: sales.reduce((sum, sale) => sum + sale.goldWeight, 0),
      totalCustomerGold: sales.reduce(
        (sum, sale) => sum + sale.customerGold,
        0,
      ),
      averageSaleValue:
        sales.length > 0
          ? sales.reduce((sum, sale) => sum + sale.calculations.totalPrice, 0) /
            sales.length
          : 0,
      pendingSales: sales.filter((s) => s.paymentStatus === "pending").length,
      partialSales: sales.filter((s) => s.paymentStatus === "partial").length,
      paidSales: sales.filter((s) => s.paymentStatus === "paid").length,
      overpaidSales: sales.filter((s) => s.paymentStatus === "overpaid").length,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// Add payment to sale (NEW)
const addPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { amount, method = "cash", note = "" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    const sale = await JewelrySale.findOne({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    await sale.addPayment(amount, method, note);

    res.status(200).json({
      success: true,
      message: "Payment added successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add payment",
      error: error.message,
    });
  }
};

// Add gold return to sale (NEW)
const addGoldReturn = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { weight, note = "" } = req.body;

    if (!weight || weight <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid gold weight is required",
      });
    }

    const sale = await JewelrySale.findOne({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    await sale.addGoldReturn(weight, note);

    res.status(200).json({
      success: true,
      message: "Gold return added successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error adding gold return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add gold return",
      error: error.message,
    });
  }
};

// Mark sale as delivered (NEW)
const markAsDelivered = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { deliveryDate } = req.body;

    const sale = await JewelrySale.findOne({ _id: id, userId });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    await sale.markAsDelivered(deliveryDate);

    res.status(200).json({
      success: true,
      message: "Sale marked as delivered",
      data: sale,
    });
  } catch (error) {
    console.error("Error marking as delivered:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark as delivered",
      error: error.message,
    });
  }
};

// Get pending payments (NEW)
const getPendingPayments = async (req, res) => {
  try {
    const userId = req.user._id;
    const sales = await JewelrySale.getPendingPayments(userId);

    res.status(200).json({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending payments",
      error: error.message,
    });
  }
};

// Get total arrears (NEW)
const getTotalArrears = async (req, res) => {
  try {
    const userId = req.user._id;
    const totalArrears = await JewelrySale.getTotalArrears(userId);

    res.status(200).json({
      success: true,
      data: {
        totalArrears,
      },
    });
  } catch (error) {
    console.error("Error fetching total arrears:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch total arrears",
      error: error.message,
    });
  }
};

// Export all functions
module.exports = {
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
};
