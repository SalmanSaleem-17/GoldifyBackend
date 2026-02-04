const ShopRecord = require("../models/ShopRecord");

// @desc    Get today's shop record
// @route   GET /api/shop-records/today
// @access  Private
exports.getTodayRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const record = await ShopRecord.getTodayRecord(userId);

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get today record error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's record",
      error: error.message,
    });
  }
};

// @desc    Get shop record by date
// @route   GET /api/shop-records/date/:dateString
// @access  Private
exports.getRecordByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateString } = req.params;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    const record = await ShopRecord.getRecordByDate(userId, dateString);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No record found for this date",
      });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get record by date error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get record",
      error: error.message,
    });
  }
};

// @desc    Add transaction to today's record
// @route   POST /api/shop-records/transaction
// @access  Private
exports.addTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, weight, customerName, notes } = req.body;

    // Validation
    if (!type || !["add", "subtract"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Use 'add' or 'subtract'",
      });
    }

    if (!weight || weight <= 0) {
      return res.status(400).json({
        success: false,
        message: "Weight must be a positive number",
      });
    }

    // Get user's custom gold rate
    const CustomGoldRate = require("../models/CustomGoldRate");
    const customRate = await CustomGoldRate.getUserRate(userId);

    if (!customRate || customRate.ratePerTola === 0) {
      return res.status(400).json({
        success: false,
        message: "Please set your custom gold rate first",
      });
    }

    // Get today's record
    const record = await ShopRecord.getTodayRecord(userId);

    // For SUBTRACT: Check if enough gold available
    if (type === "subtract") {
      if (record.balance < weight) {
        return res.status(400).json({
          success: false,
          message: `Insufficient gold. Available: ${record.balance.toFixed(3)}g`,
        });
      }
    }

    // Calculate price based on weight and rate
    const pricePerGram = customRate.ratePerGram;
    const totalPrice = parseFloat((weight * pricePerGram).toFixed(2));

    // Create rate snapshot
    const rateSnapshot = {
      ratePerTola: customRate.ratePerTola,
      ratePerGram: customRate.ratePerGram,
      ratePerOunce: customRate.ratePerOunce,
      symbol: customRate.symbol,
      currency: customRate.currency,
    };

    // Add new transaction
    const newTransaction = {
      type,
      weight: parseFloat(parseFloat(weight).toFixed(3)),
      customGoldRateId: customRate._id,
      rateSnapshot,
      timestamp: new Date(),
    };

    // Add sale details for subtract transactions
    if (type === "subtract") {
      newTransaction.saleDetails = {
        totalPrice,
        customerName: customerName || "Walk-in Customer",
        notes: notes || "",
      };
    }

    record.transactions.push(newTransaction);
    record.calculateTotals();
    await record.save();

    // Populate the custom gold rate in response
    await record.populate("transactions.customGoldRateId");

    res.status(201).json({
      success: true,
      message: "Transaction added successfully",
      data: record,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Add transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add transaction",
      error: error.message,
    });
  }
};

// @desc    Delete transaction from today's record
// @route   DELETE /api/shop-records/transaction/:transactionId
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;

    const record = await ShopRecord.getTodayRecord(userId);

    // Find and remove transaction
    const transactionIndex = record.transactions.findIndex(
      (t) => t._id.toString() === transactionId,
    );

    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    record.transactions.splice(transactionIndex, 1);
    record.calculateTotals();
    await record.save();

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
      data: record,
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete transaction",
      error: error.message,
    });
  }
};

// @desc    Clear all transactions from today's record
// @route   DELETE /api/shop-records/clear
// @access  Private
exports.clearTodayRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const record = await ShopRecord.getTodayRecord(userId);

    record.transactions = [];
    record.calculateTotals();
    await record.save();

    res.status(200).json({
      success: true,
      message: "All transactions cleared successfully",
      data: record,
    });
  } catch (error) {
    console.error("Clear record error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear transactions",
      error: error.message,
    });
  }
};

// @desc    Get records in date range
// @route   GET /api/shop-records/range
// @access  Private
exports.getRecordsInRange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const records = await ShopRecord.getRecordsInRange(
      userId,
      startDate,
      endDate,
    );

    // Calculate totals across all records
    const totalAdd = records.reduce((sum, r) => sum + r.addTotal, 0);
    const totalSubtract = records.reduce((sum, r) => sum + r.subtractTotal, 0);
    const totalBalance = totalAdd - totalSubtract;

    res.status(200).json({
      success: true,
      data: {
        records,
        summary: {
          totalDays: records.length,
          totalAdd: parseFloat(totalAdd.toFixed(3)),
          totalSubtract: parseFloat(totalSubtract.toFixed(3)),
          totalBalance: parseFloat(totalBalance.toFixed(3)),
        },
      },
    });
  } catch (error) {
    console.error("Get records in range error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get records",
      error: error.message,
    });
  }
};

// @desc    Get monthly summary
// @route   GET /api/shop-records/monthly/:year/:month
// @access  Private
exports.getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.params;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid year or month",
      });
    }

    const result = await ShopRecord.getMonthlySummary(
      userId,
      yearNum,
      monthNum,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get monthly summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get monthly summary",
      error: error.message,
    });
  }
};

// @desc    Get recent records (last 7 days)
// @route   GET /api/shop-records/recent
// @access  Private
exports.getRecentRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 7;

    const records = await ShopRecord.find({
      userId,
      isActive: true,
    })
      .sort({ date: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Get recent records error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent records",
      error: error.message,
    });
  }
};

// @desc    Get statistics summary
// @route   GET /api/shop-records/statistics
// @access  Private
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current month data
    const now = new Date();
    const currentMonth = await ShopRecord.getMonthlySummary(
      userId,
      now.getFullYear(),
      now.getMonth() + 1,
    );

    // Get all-time statistics
    const allRecords = await ShopRecord.find({
      userId,
      isActive: true,
    });

    const allTimeAdd = allRecords.reduce((sum, r) => sum + r.addTotal, 0);
    const allTimeSubtract = allRecords.reduce(
      (sum, r) => sum + r.subtractTotal,
      0,
    );
    const allTimeBalance = allTimeAdd - allTimeSubtract;

    // Get today's record
    const todayRecord = await ShopRecord.getTodayRecord(userId);

    res.status(200).json({
      success: true,
      data: {
        today: {
          addTotal: todayRecord.addTotal,
          subtractTotal: todayRecord.subtractTotal,
          balance: todayRecord.balance,
          transactionCount: todayRecord.transactions.length,
        },
        currentMonth: currentMonth.summary,
        allTime: {
          totalDays: allRecords.length,
          totalAdd: parseFloat(allTimeAdd.toFixed(3)),
          totalSubtract: parseFloat(allTimeSubtract.toFixed(3)),
          totalBalance: parseFloat(allTimeBalance.toFixed(3)),
        },
      },
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get statistics",
      error: error.message,
    });
  }
};

// @desc    Update transaction (edit weight or type)
// @route   PUT /api/shop-records/transaction/:transactionId
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;
    const { weight, type } = req.body;

    const record = await ShopRecord.getTodayRecord(userId);

    // Find transaction
    const transaction = record.transactions.id(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Update fields
    if (weight !== undefined) {
      if (weight <= 0) {
        return res.status(400).json({
          success: false,
          message: "Weight must be a positive number",
        });
      }
      transaction.weight = parseFloat(parseFloat(weight).toFixed(3));
    }

    if (type !== undefined) {
      if (!["add", "subtract"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid transaction type",
        });
      }
      transaction.type = type;
    }

    record.calculateTotals();
    await record.save();

    res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: record,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transaction",
      error: error.message,
    });
  }
};

module.exports = exports;
