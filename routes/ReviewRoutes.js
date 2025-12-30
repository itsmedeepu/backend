const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/ReviewController");
const { BasicAuth, UserAuth } = require("../middlewares/Auth");

router.post("/add", [UserAuth], ReviewController.addReview);
router.get("/all", ReviewController.getAllReviews);
router.get("/:farmerId", ReviewController.getReviews);

module.exports = router;
