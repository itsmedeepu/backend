const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    amount: Number,
    paymentMode: String,
    paymentStatus: String,
  },
  { timestamps: true }
);
module.exports = mongoose.model("Transaction", transactionSchema);
