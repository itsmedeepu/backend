const Order = require("../models/OrderModel");
const Product = require("../models/ProductModel");
const User = require("../models/UserModel");
const Transaction = require("../models/Transaction");
const Delivery = require("../models/DeliveryModel");
const mongoose = require("mongoose");

/**
 * Create a new order (Checkout).
 * Handles stock deduction, order grouping by farmer, and transaction creation.
 */
exports.createOrder = async (req, res) => {
    try {
        const { items, paymentMethod, deliveryAddress } = req.body; 
        const buyerId = req.user.id; 

        if (!buyerId) {
            return res.status(401).json({ message: "Unauthorized: User not logged in." });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty. Please add items to proceed.' });
        }

        // 1. Group items by farmer/vendor and validate stock
        const ordersByFarmer = {};
        const productDetailsMap = new Map();

        for (const item of items) {
            const productId = item.product;
            const requestedQuantity = Number(item.quantity);

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ message: `Invalid product ID: ${productId}` });
            }

            let product = productDetailsMap.get(productId);
            if (!product) {
                product = await Product.findById(productId);
                if (!product) {
                    return res.status(404).json({ message: `Product not found: ${productId}` });
                }
                productDetailsMap.set(productId, product);
            }
            
            // Check stock availability
            if (product.stock < requestedQuantity) {
                 return res.status(400).json({ 
                     message: `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${requestedQuantity}.` 
                 });
            }
            if (!product.available) {
                return res.status(400).json({ message: `Product ${product.name} is currently not available for purchase.` });
            }

            const farmerId = product.farmer.toString();
            
            if (!ordersByFarmer[farmerId]) {
                ordersByFarmer[farmerId] = {
                    farmer: farmerId,
                    items: [],
                    subtotal: 0
                };
            }

            ordersByFarmer[farmerId].items.push({
                product: productId,
                quantity: requestedQuantity,
                price: product.price // Lock in the price
            });
            
            ordersByFarmer[farmerId].subtotal += (product.price * requestedQuantity);
        }

        // 2. Create orders
        const createdOrders = [];
        const orderCreationPromises = Object.values(ordersByFarmer).map(async (orderData) => {
            
            // Deduct stock for each item
            for (const item of orderData.items) {
                 await Product.findByIdAndUpdate(item.product, {
                     $inc: { stock: -item.quantity }
                 });
            }

            // Create Order
            const newOrder = new Order({
                user: buyerId,
                farmer: orderData.farmer,
                items: orderData.items,
                totalAmount: orderData.subtotal,
                status: 'Pending',
                paymentMode: paymentMethod || 'COD',
                deliveryAddress: deliveryAddress || null
            });

            const savedOrder = await newOrder.save();

            // Create Transaction
            const newTransaction = new Transaction({
                farmer: orderData.farmer,
                order: savedOrder._id,
                amount: orderData.subtotal,
                paymentMode: paymentMethod || 'COD',
                paymentStatus: 'Pending',
                user: buyerId
            });
            const savedTransaction = await newTransaction.save();

            // Link Transaction
            savedOrder.transactionDetails = {
                transactionId: savedTransaction._id,
                date: savedTransaction.createdAt
            };
            await savedOrder.save();

            // Populate for response
            const populatedOrder = await Order.findById(savedOrder._id)
                .populate('items.product', 'name price image unit')
                .populate('farmer', 'name email farmDetails phone')
                .populate('user', 'name email phone address')
                .populate('transactionDetails.transactionId');
            
            return populatedOrder;
        });

        const results = await Promise.all(orderCreationPromises);
        createdOrders.push(...results);

        res.status(201).json({ 
            message: `${createdOrders.length} orders placed successfully!`, 
            orders: createdOrders,
            order: createdOrders[0] 
        });

    } catch (error) {
        console.error("Order creation failed:", error);
        res.status(500).json({ message: 'Failed to place order. Please try again.', error: error.message });
    }
};

/**
 * Get orders for the logged-in user (customer or farmer).
 * Supports filtering by status and pagination.
 */
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { page = 1, limit = 20, status, sort = "-createdAt" } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        
        let query = {};

        // Role-based filtering
        if (userRole === "farmer") {
            query.farmer = userId;
        } else {
            query.user = userId;
        }
        
        // Apply status filter
        if (status && status !== 'All') {
            query.status = status;
        }

        const [orders, totalOrders] = await Promise.all([
            Order.find(query)
                .populate('items.product', 'name price image unit')
                .populate('farmer', 'name email farmDetails phone')
                .populate('user', 'name email phone address')
                .populate('transactionDetails.transactionId')
                .populate('delivery')
                .populate('review')
                .sort(sort)
                .skip(skip)
                .limit(Number(limit)),
            Order.countDocuments(query),
        ]);

        res.json({ 
            orders, 
            total: totalOrders, 
            page: Number(page), 
            limit: Number(limit),
            totalPages: Math.ceil(totalOrders / Number(limit))
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: 'Could not fetch orders.' });
    }
};

/**
 * Get a single order by ID.
 */
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: `Invalid order ID: ${id}` });
        }

        const order = await Order.findById(id)
            .populate('items.product', 'name price image unit')
            .populate('farmer', 'name email farmDetails phone')
            .populate('user', 'name email phone address')
            .populate('review')
            .populate('delivery')
            .populate({
                path: 'transactionDetails.transactionId',
                model: Transaction
            });

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const isBuyer = String(order.user) === String(userId);
        const isFarmer = String(order.farmer) === String(userId);
        const isAdmin = userRole === "admin";

        if (!isBuyer && !isFarmer && !isAdmin) {
            return res.status(403).json({ message: 'Access denied: You are not authorized to view this order.' });
        }

        res.json(order);
    } catch (error) {
        console.error("Error fetching order by ID:", error);
        res.status(500).json({ message: 'Could not fetch order details.' });
    }
};

/**
 * Update order status.
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, deliveryDetails, cancellationReason } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        const allowed = ["Pending", "Accepted", "Rejected", "Shipped", "Delivered", "Cancelled"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        // only farmer of order or admin can update status
        if (String(order.farmer) !== String(userId) && userRole !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }

        // Restore stock if being cancelled/rejected
        if ((status === 'Cancelled' || status === 'Rejected') && status !== order.status) {
             if (order.status !== 'Cancelled' && order.status !== 'Rejected') {
                 for (const item of order.items) {
                     await Product.findByIdAndUpdate(item.product, {
                         $inc: { stock: item.quantity }
                     });
                 }
             }
        }

        order.status = status;
        if ((status === 'Cancelled' || status === 'Rejected') && cancellationReason) {
            order.cancellationReason = cancellationReason;
        }

        // Handle Delivery Updates
        if (status === "Shipped" && deliveryDetails) {
            const deliveryObj = {
                order: order._id,
                carrierName: deliveryDetails.carrierName || "Pending",
                trackingId: deliveryDetails.trackingId || "N/A",
                phone: deliveryDetails.phone || "N/A",
                status: "Shipped",
                shippedDate: new Date(),
                address: deliveryDetails.customerAddress || order.user?.address || "N/A",
                customerContact: {
                    name: deliveryDetails.customerName || "N/A",
                    phone: deliveryDetails.customerPhone || "N/A",
                    email: deliveryDetails.customerEmail || "N/A",
                },
            };

            let deliveryDoc;
            if (order.delivery) {
                deliveryDoc = await Delivery.findByIdAndUpdate(order.delivery, deliveryObj, { new: true });
            } else {
                deliveryDoc = new Delivery(deliveryObj);
                await deliveryDoc.save();
                order.delivery = deliveryDoc._id;
            }
        } else if (status === "Delivered" && order.delivery) {
            await Delivery.findByIdAndUpdate(order.delivery, { 
                status: "Delivered", 
                deliveredDate: new Date() 
            });
        }

        await order.save();
        await order.populate("delivery");

        res.json({ message: `Order status updated to ${status}`, order });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ message: 'Failed to update status.' });
    }
};

/**
 * Cancel an order (For Customers).
 */
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (String(order.user) !== String(userId)) {
            return res.status(403).json({ message: "Access denied" });
        }
        if (order.status !== "Pending") {
            return res.status(400).json({ message: "Only pending orders can be cancelled" });
        }

        // Restore stock
        for (const item of order.items) {
             await Product.findByIdAndUpdate(item.product, {
                 $inc: { stock: item.quantity }
             });
        }

        order.status = "Cancelled";
        order.cancellationReason = "Customer cancelled request";
        await order.save();

        res.json({ message: "Order cancelled successfully", order });
    } catch (err) {
        console.error("Error cancelling order:", err);
        res.status(500).json({ message: err.message });
    }
};
