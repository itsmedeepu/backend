const express = require("express");
const router = express.Router();

const TransactionController = require("../controllers/TransactionController");
const { UserAuth } = require("../middlewares/Auth");

router.get("/transactions", [UserAuth], TransactionController.getTransactions);
router.get(
  "/transactions/:id",
  [UserAuth],
  TransactionController.getTransactionById
);
router.patch(
  "/update/:id",
  [UserAuth],
  TransactionController.updateTransaction
);
router.delete(
  "/delete/:id",
  [UserAuth],
  TransactionController.deleteTransaction
);

module.exports = router;
