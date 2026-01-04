const Transaction = require("../models/Transaction");

const Order = require("../models/OrderModel");

exports.createTransaction = async (req, res) => {
  try {
    if (!Transaction)
      return res
        .status(500)
        .json({ message: "Transaction model not available" });

    const { orderId, amount, paymentMode, paymentStatus } = req.body;
    if (!orderId || amount == null)
      return res.status(400).json({ message: "orderId and amount required" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (
      String(order.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const tx = await Transaction.create({
      farmer: order.farmer,
      order: order._id,
      amount,
      paymentMode,
      paymentStatus,
    });

    order.transactionDetails = { transactionId: tx._id, date: new Date() };
    await order.save();

    res.status(201).json({ message: "Transaction created", transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    if (!Transaction)
      return res
        .status(500)
        .json({ message: "Transaction model not available" });

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (req.user?.role === "farmer") filter.farmer = req.user.id;
    else if (req.user?.role === "user") {
      const userOrders = await Order.find({ user: req.user.id }).select("_id");
      const orderIds = userOrders.map((o) => o._id);
      filter.order = { $in: orderIds };
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("order")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    if (!Transaction)
      return res
        .status(500)
        .json({ message: "Transaction model not available" });

    const { id } = req.params;
    const tx = await Transaction.findById(id).populate("order");
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    if (
      String(tx.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin" &&
      String(tx.order?.user) !== String(req.user?.id)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    if (!Transaction)
      return res
        .status(500)
        .json({ message: "Transaction model not available" });
    const { id } = req.params;
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    if (
      String(tx.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const allowed = ["amount", "paymentMode", "paymentStatus"];
    const updates = {};
    for (const k of allowed)
      if (req.body[k] !== undefined) updates[k] = req.body[k];

    const updated = await Transaction.findByIdAndUpdate(id, updates, {
      new: true,
    }).populate("order");

    res.json({ message: "Transaction updated", transaction: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    if (!Transaction)
      return res
        .status(500)
        .json({ message: "Transaction model not available" });
    const { id } = req.params;
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: "Transaction not found" });

    if (
      String(tx.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Transaction.findByIdAndDelete(id);
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
