const Order = require("../models/OrderModel");
const Product = require("../models/ProductModel");
const User = require("../models/UserModel");
const Transaction = require("../models/Transaction");
const Review = require("../models/ReviewModel"); // Ensure Review model is registered
const mongoose = require("mongoose");

console.log('--- REFRESH: Model Registry ---');
console.log('Available Models:', mongoose.modelNames());
console.log('Transaction Model Registered:', mongoose.modelNames().includes('Transaction'));

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    console.log('Order creation request body:', JSON.stringify(req.body, null, 2));

    const { items, paymentMode, paymentStatus, paymentAmount } = req.body; // items: [{ product: id, quantity }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items required" });
    }

    const productIds = items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length === 0) {
      return res.status(400).json({ message: "No products found" });
    }

    // Map items to their products for easy lookup
    const productMap = {};
    products.forEach(p => { productMap[String(p._id)] = p; });

    // Group items by farmer
    const groupedItems = {};
    for (const item of items) {
      const product = productMap[String(item.product)];
      if (!product) continue;
      if (!product.available) {
        return res.status(400).json({ message: `Product ${product.name} is not available` });
      }
      const farmerId = String(product.farmer);
      if (!groupedItems[farmerId]) groupedItems[farmerId] = [];
      groupedItems[farmerId].push(item);
    }

    const createdOrders = [];

    for (const farmerId in groupedItems) {
      const farmerItems = groupedItems[farmerId];
      let groupTotal = 0;
      const normalizedItems = farmerItems.map(it => {
        const product = productMap[String(it.product)];
        const qty = Number(it.quantity);
        groupTotal += (product.price || 0) * qty;
        return { product: it.product, quantity: qty };
      });

      const order = await Order.create({
        user: userId,
        farmer: farmerId,
        items: normalizedItems,
        totalAmount: groupTotal,
      });

      // Handle transactions per order - always create transaction
      const finalPaymentMode = paymentMode || "COD";
      const finalPaymentStatus = paymentStatus || "Pending";
      
      console.log('Creating transaction with:', { finalPaymentMode, finalPaymentStatus, groupTotal });
      
      const tx = await Transaction.create({
        farmer: farmerId,
        order: order._id,
        amount: groupTotal,
        paymentMode: finalPaymentMode,
        paymentStatus: finalPaymentStatus,
      });

      order.transactionDetails = { transactionId: tx._id, date: new Date() };
      await order.save();
      
      console.log('Transaction created:', tx._id, 'for order:', order._id);

      let populatedOrder = await Order.findById(order._id)
        .populate("items.product", "name price image")
        .populate("farmer", "name email phone farmDetails")
        .populate("user", "name email phone")
        .populate("transactionDetails.transactionId");

      // Manual population fallback if needed
      if (populatedOrder && populatedOrder.transactionDetails?.transactionId && typeof populatedOrder.transactionDetails.transactionId !== 'object') {
        console.log('Manual population needed for order:', order._id);
        populatedOrder = await populatedOrder.populate("transactionDetails.transactionId");
      }

      console.log('--- SERVER DEBUG: CREATED ORDER ---');
      console.log('Order ID:', populatedOrder._id);
      console.log('Transaction Details:', populatedOrder.transactionDetails);
      console.log('Transaction ID type:', typeof populatedOrder.transactionDetails?.transactionId);

      createdOrders.push(populatedOrder);
    }

    res.status(201).json({ 
      message: `${createdOrders.length} orders created`, 
      orders: createdOrders,
      order: createdOrders[0] // Backward compatibility for single-farmer carts
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sort = "-createdAt" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    // role-based: farmer sees orders for their farm, user sees own orders
    if (req.user?.role === "farmer") filter.farmer = req.user.id;
    else filter.user = req.user?.id;

    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("items.product", "name price image")
        .populate("farmer", "name email phone farmDetails")
        .populate("user", "name email phone")
        .populate("transactionDetails.transactionId")
        .populate("review")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    console.log('--- SERVER DEBUG: GET ORDERS ---');
    console.log('Orders Fetched:', orders.length);
    if (orders.length > 0) {
      console.log('First Order Transaction:', JSON.stringify(orders[0].transactionDetails?.transactionId, null, 2));
    }

    res.json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate("items.product", "name price image")
      .populate("farmer", "name email phone farmDetails")
      .populate("user", "name email phone")
      .populate("review")
      .populate({
        path: "transactionDetails.transactionId",
        model: Transaction
      });

    if (!order) return res.status(404).json({ message: "Order not found" });

    // permission: user who placed or farmer of order can view
    if (
      String(order.user) !== String(req.user?.id) &&
      String(order.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["Pending", "Accepted", "Rejected", "Shipped", "Delivered"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // only farmer of order or admin can update status
    if (
      String(order.farmer) !== String(req.user?.id) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    order.status = status;
    await order.save();

    res.json({ message: "Order status updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // only the user who placed the order can cancel and only if pending
    if (String(order.user) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (order.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Only pending orders can be cancelled" });
    }

    order.status = "Cancelled";
    await order.save();

    res.json({ message: "Order cancelled", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
