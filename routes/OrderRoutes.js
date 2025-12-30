const express = require("express");
const router = express.Router();

const OrderController = require("../controllers/OrderController");
const { UserAuth } = require("../middlewares/Auth");

router.post("/create", [UserAuth], OrderController.createOrder);
router.get("/", [UserAuth], OrderController.getOrders);
router.get("/:id", [UserAuth], OrderController.getOrderById);
router.patch("/:id/status", [UserAuth], OrderController.updateOrderStatus);
router.patch("/:id/cancel", [UserAuth], OrderController.cancelOrder);
module.exports = router;
