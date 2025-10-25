// routes/purchase.js
const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../db');

// CREATE PURCHASE - This is the endpoint your frontend needs
router.post('/', async (req, res) => {
  try {
    const {
      foodId,
      foodName,
      foodImage,
      price,
      quantity,
      totalPrice,
      buyerName,
      buyerEmail,
      buyerPhoto,
      deliveryAddress,
      contactNumber,
      specialInstructions,
      paymentMethod,
      status = 'pending'
    } = req.body;

    const purchasesCollection = getDB().collection('purchases');
    const foodsCollection = getDB().collection('foods');

    console.log('🛒 Creating purchase for:', buyerEmail);

    // Validate required fields
    if (!foodId || !buyerEmail || !deliveryAddress || !contactNumber) {
      return res.status(400).send({ 
        error: "Missing required fields: foodId, buyerEmail, deliveryAddress, contactNumber" 
      });
    }

    // Validate food exists and has sufficient quantity
    const food = await foodsCollection.findOne({ _id: new ObjectId(foodId) });
    if (!food) {
      return res.status(404).send({ error: "Food item not found" });
    }

    if (food.quantity < quantity) {
      return res.status(400).send({ 
        error: `Insufficient quantity. Only ${food.quantity} ${food.foodName} available.` 
      });
    }

    // Create purchase object
    const purchase = {
      foodId: new ObjectId(foodId),
      foodName,
      foodImage,
      price: parseFloat(price),
      quantity: parseInt(quantity),
      totalPrice: parseFloat(totalPrice),
      buyerName,
      buyerEmail,
      buyerPhoto,
      deliveryAddress,
      contactNumber,
      specialInstructions: specialInstructions || '',
      paymentMethod: paymentMethod || 'card',
      status: 'pending',
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert purchase
    const result = await purchasesCollection.insertOne(purchase);
    
    console.log('✅ Purchase created successfully:', result.insertedId);

    res.status(201).send({
      success: true,
      message: "Purchase created successfully",
      purchaseId: result.insertedId,
      purchase: { ...purchase, _id: result.insertedId }
    });

  } catch (error) {
    console.error("❌ Create purchase error:", error);
    res.status(500).send({ error: "Failed to create purchase: " + error.message });
  }
});

// Get all purchases (for admin)
router.get('/all', async (req, res) => {
  try {
    console.log("Fetching all purchases for admin...");
    const purchasesCollection = getDB().collection('purchases');
    
    const purchases = await purchasesCollection.find({})
      .sort({ date: -1 })
      .toArray();
    
    console.log(`Found ${purchases.length} purchases`);
    res.send(purchases);
  } catch (error) {
    console.error("Get all purchases error:", error);
    res.status(500).send({ error: "Failed to fetch purchases" });
  }
});

// Get user purchases (for customers)
router.get('/', async (req, res) => {
  try {
    const buyerEmail = req.query.buyerEmail;
    const purchasesCollection = getDB().collection('purchases');
    
    if (!buyerEmail) {
      return res.status(400).send({ error: "buyerEmail query parameter is required" });
    }
    
    const query = { buyerEmail };
    const purchases = await purchasesCollection.find(query)
      .sort({ date: -1 })
      .toArray();
    res.send(purchases);
  } catch (error) {
    console.error("Get purchases error:", error);
    res.status(500).send({ error: "Failed to fetch purchases" });
  }
});

// Update purchase status
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const purchasesCollection = getDB().collection('purchases');
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid purchase ID" });
    }
    
    if (!status) {
      return res.status(400).send({ error: "Status is required" });
    }

    const query = { _id: new ObjectId(id) };
    const update = {
      $set: {
        status: status,
        updatedAt: new Date()
      }
    };
    
    const result = await purchasesCollection.updateOne(query, update);
    
    if (result.modifiedCount === 1) {
      res.send({ message: "Order status updated successfully" });
    } else {
      res.status(404).send({ error: "Order not found" });
    }
  } catch (error) {
    console.error("Update purchase error:", error);
    res.status(500).send({ error: "Failed to update order status" });
  }
});

// Delete purchase
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const purchasesCollection = getDB().collection('purchases');
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid purchase ID" });
    }
    
    const query = { _id: new ObjectId(id) };
    const result = await purchasesCollection.deleteOne(query);
    
    if (result.deletedCount === 1) {
      res.send({ message: "Purchase deleted successfully" });
    } else {
      res.status(404).send({ error: "Purchase not found" });
    }
  } catch (error) {
    console.error("Delete purchase error:", error);
    res.status(500).send({ error: "Failed to delete purchase" });
  }
});

module.exports = router;