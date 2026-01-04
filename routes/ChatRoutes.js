const express = require('express');
const router = express.Router();
const Chat = require('../models/ChatModel');
const { UserAuth } = require('../middlewares/Auth');

// Get chat history for a specific order
router.get('/history/:orderId', [UserAuth], async (req, res) => {
  try {
    const { orderId } = req.params;
    const messages = await Chat.find({ orderId })
      .sort({ timestamp: 1 }) // Oldest first
      .populate('senderId', 'name')
      .populate('receiverId', 'name');
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get active conversations (orders with chat history) for the user
router.get('/conversations', [UserAuth], async (req, res) => {
  try {
    const userId = req.user.id;
    // Find all chats where user is sender or receiver
    const chats = await Chat.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    }).distinct('orderId');

    const Order = require('../models/OrderModel');
    
    // Fetch full order details for these IDs
    const orders = await Order.find({ _id: { $in: chats } })
      .populate("items.product", "name price image")
      .populate("farmer", "name email phone farmDetails")
      .populate("user", "name email phone")
      .populate("transactionDetails.transactionId")
      .sort({ updatedAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
