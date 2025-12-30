const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: Number,
      },
    ],
    totalAmount: Number,
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    transactionDetails: { 
      transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }, 
      date: Date 
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual populate for review
orderSchema.virtual("review", {
  ref: "Review",
  localField: "_id",
  foreignField: "order",
  justOne: true,
});

const OrderModel = mongoose.model("Order", orderSchema);

module.exports = OrderModel;
