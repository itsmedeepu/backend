const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const ProductController = require("../controllers/ProductController");
const { BasicAuth, UserAuth } = require("../middlewares/Auth");

const cloudinary = require("../utils/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "agridirect/products",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    public_id: (req, file) => {
       const name = file.originalname.split('.')[0];
       return `${Date.now()}-${name}`;
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.get("/getproducts", ProductController.getProducts);
router.get("/get/:id", ProductController.getProductById);

router.post(
  "/create",
  [UserAuth, upload.single("image")],
  ProductController.createProduct
);
router.patch(
  "/update/:id",
  [UserAuth, upload.single("image")],
  ProductController.updateProduct
);
router.delete("/delete/:id", [UserAuth], ProductController.deleteProduct);

module.exports = router;
