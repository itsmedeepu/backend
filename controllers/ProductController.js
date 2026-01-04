const Product = require('../models/ProductModel');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../utils/cloudinary');

const cleanupFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error(`[Warning] Failed to delete local file: ${filePath}`, err);
        });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, description, price, category, unit, stock } = req.body;
        const farmerId = req.user.id; 

        if (!name || !price || !category) {
            return res.status(400).json({ message: 'Please provide at least a name, price, and category.' });
        }

        let imageUrl = '';
        
        if (req.file) {
            imageUrl = req.file.path; 
        } else {
            imageUrl = 'https://via.placeholder.com/150'; 
        }

        const newProduct = new Product({
            name,
            description,
            price,
            category,
            unit: unit || 'kg', 
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

exports.getAllProducts = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;
        let query = {};

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' }; 
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [products, total] = await Promise.all([
            Product.find(query)
                .populate('farmer', 'name farmDetails')
                .skip(skip)
                .limit(Number(limit))
                .sort({ createdAt: -1 }), 
            Product.countDocuments(query)
        ]);

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

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const farmerId = req.user.id;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        if (product.farmer.toString() !== farmerId) {
            return res.status(403).json({ message: 'You are not authorized to edit this product.' });
        }

        if (req.file) {
            updates.image = req.file.path;

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

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('farmer', 'name email farmDetails');
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({ message: 'Server error' });
    }
};
