const UserAuthController = require("../controllers/user/AuthController");
const UserController = require("../controllers/user/UserController");
const { BasicAuth, UserAuth } = require("../middlewares/Auth");


const express = require("express");
const router = express.Router();

router.get("/getuser", [BasicAuth, UserAuth], UserController.GetUserDetails);
router.get("/refreshtoken", UserController.refreshAccessToken);
router.get("/farms", UserController.getFarms);

// public list of farms (farmer profiles)

router.post("/register",UserAuthController.register);
router.post("/login", UserAuthController.login);
router.post("/resetpassword", [UserAuth], UserController.resetPassword);
router.patch("/updateuser", [UserAuth], UserController.updateUserDetails);
router.patch("/updatefarm", [UserAuth], UserController.updateFarmDetails);

module.exports = router;
