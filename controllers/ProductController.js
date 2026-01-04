const Product = require('../models/ProductModel');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../utils/cloudinary');

// --- Helper Functions ---

// Clean up local file if it exists (legacy support)
const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error(`[Warning] Failed to delete local file: ${filePath}`, err);
        });
    }
};

// --- Controller Actions ---

/**
 * Create a new product listing.
 * handles image upload via Cloudinary or local fallback.
 */
exports.createProduct = async (req, res) => {
    try {
        const { name, description, price, category, unit, stock } = req.body;
        const farmerId = req.user.id; // User ID from auth middleware

        // Validate required fields (basic check)
        if (!name || !price || !category) {
            return res.status(400).json({ message: 'Please provide at least a name, price, and category.' });
        }

        let imageUrl = '';
        
        // Handle image upload
        if (req.file) {
            // If using Cloudinary storage, path is the remote URL
            imageUrl = req.file.path; 
        } else {
            // Default placeholder if no image provided
            imageUrl = 'https://via.placeholder.com/150'; 
        }

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            unit: unit || 'kg', // Default to kg if not specified
            stock: stock || 0,
            image: imageUrl,
            farmer: farmerId
        });

        const savedProduct = await newProduct.save();

        res.status(201).json({
            message: 'Product listed successfully!',
            product: savedProduct
        });

    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: 'Server error while creating product.', error: error.message });
    }
};

/**
 * Get all products for the marketplace.
 * Supports filtering by category and search queries.
 */
exports.getAllProducts = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;
        let query = {};

        // Apply filters if present
        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' }; // Case-insensitive search
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Fetch products and populate farmer details (name and farm name)
        const [products, total] = await Promise.all([
            Product.find(query)
                .populate('farmer', 'name farmName')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 }), // Newest first
            Product.countDocuments(query)
        ]);

        // Return object with products array and pagination info to match frontend API expectation
        res.json({
            products,
            total,
            page: Number(page),
            limit: Number(limit)
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: 'Could not fetch products.' });
    }
};

/**
 * Get products specifically for the logged-in farmer.
 */
exports.getMyProducts = async (req, res) => {
    try {
        const farmerId = req.user.id;
        const products = await Product.find({ farmer: farmerId }).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error("Error fetching farmer's products:", error);
        res.status(500).json({ message: 'Could not load your products.' });
    }
};

/**
 * Update an existing product.
 * Only the owner (farmer) can update their product.
 */
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const farmerId = req.user.id;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Authorization check
        if (product.farmer.toString() !== farmerId) {
            return res.status(403).json({ message: 'You are not authorized to edit this product.' });
        }

        // Handle Image Update
        if (req.file) {
            // 1. Update the image URL in the database
            updates.image = req.file.path;

            // 2. Try to clean up the old image if it was a local file (legacy)
            if (product.image && !product.image.startsWith('http')) {
                 const oldPath = path.join(__dirname, '..', product.image);
                 cleanupFile(oldPath);
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });
        
        res.json({
            message: 'Product updated successfully.',
            product: updatedProduct
        });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: 'Server error during update.' });
    }
};

/**
 * Delete a product.
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const farmerId = req.user.id;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        if (product.farmer.toString() !== farmerId) {
            return res.status(403).json({ message: 'You are not authorized to delete this product.' });
        }

        // Attempt to clean up local image file
        if (product.image && !product.image.startsWith('http')) {
             const imagePath = path.join(__dirname, '..', product.image);
             cleanupFile(imagePath);
        }

        await Product.findByIdAndDelete(id);

        res.json({ message: 'Product deleted successfully.' });

    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: 'Could not delete product.' });
    }
};

/**
 * Get a single product by ID.
 */
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('farmer', 'name email farmName');
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({ message: 'Server error' });
    }
};
