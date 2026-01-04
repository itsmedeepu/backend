const Product = require("../models/ProductModel");
const Review = require("../models/ReviewModel");
const fs = require("fs");
const path = require("path");

exports.createProduct = async (req, res) => {
  try {
    if (req.user?.role !== "farmer") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name, price, category, unit, image, available, description, stock } = req.body;

    if (!name || price == null || !unit) {
      return res
        .status(400)
        .json({ message: "name, price and unit are required" });
    }

    // handle uploaded file (multer-storage-cloudinary provides path as url)
    const imagePath = req.file ? req.file.path : image;

    const product = await Product.create({
      name,
      price,
      category,
      unit,
      image: imagePath,
      available: available ?? true,
      description,
      stock: stock ? Number(stock) : 0,
      farmer: req.user.id,
    });

    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      farmer,
      available,
      search,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (farmer) filter.farmer = farmer;
    // availability: 'true', 'false', or 'all'
    if (available === "all") {
      // no availability filter
    } else if (available !== undefined) {
      filter.available = available === "true";
    } else {
      filter.available = true; // default for public view
    }
    if (search) filter.name = { $regex: search, $options: "i" };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("farmer", "name farmDetails")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    // Calculate ratings
    const farmerIds = [...new Set(products.map(p => p.farmer?._id))];
    const reviewsAggregation = await Review.aggregate([
      { $match: { farmer: { $in: farmerIds } } },
      { $group: { _id: "$farmer", avgRating: { $avg: "$rating" } } }
    ]);
    
    const ratingsMap = {};
    reviewsAggregation.forEach(r => ratingsMap[r._id.toString()] = r.avgRating);

    const productsWithRatings = products.map(p => {
      const pObj = p.toObject();
      const fId = p.farmer?._id?.toString();
      pObj.farmerRating = fId && ratingsMap[fId] ? ratingsMap[fId] : 0;
      return pObj;
    });

    res.json({ products: productsWithRatings, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate(
      "farmer",
      "farmDetails"
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // only owning farmer can update
    if (String(product.farmer) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = {};
    const allowed = ["name", "price", "category", "unit", "image", "available", "description", "stock"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // if a new file was uploaded, set image
    if (req.file) {
      const newImagePath = req.file.path;
      updates.image = newImagePath;

      // Only delete local file if it was a local upload
      if (product.image && product.image.startsWith("/uploads/products/")) {
        const fileOnDisk = path.join(__dirname, "..", product.image);
        try {
          if (fs.existsSync(fileOnDisk)) {
             fs.unlinkSync(fileOnDisk);
          }
        } catch(e) { /* ignore */ }
      }
    }

    const updated = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("farmer", "farmDetails");

    res.json({ message: "Product updated", product: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (String(product.farmer) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // soft delete: mark unavailable
    product.available = false;
    await product.save();

    res.json({ message: "Product removed (set unavailable)", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
