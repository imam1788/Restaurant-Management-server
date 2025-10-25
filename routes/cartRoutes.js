const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../db');

// Get user's cart
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const cartsCollection = getDB().collection('carts');
    
    let cart = await cartsCollection.findOne({ userEmail: email });
    
    if (!cart) {
      // Create empty cart if doesn't exist
      cart = {
        userEmail: email,
        items: [],
        total: 0,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await cartsCollection.insertOne(cart);
    }
    
    res.send(cart);
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).send({ error: "Failed to fetch cart" });
  }
});

// Add item to cart
router.post('/:email/items', async (req, res) => {
  try {
    const email = req.params.email;
    const { foodId, quantity } = req.body;
    const cartsCollection = getDB().collection('carts');
    const foodsCollection = getDB().collection('foods');

    // Validate food exists
    const food = await foodsCollection.findOne({ _id: new ObjectId(foodId) });
    if (!food) {
      return res.status(404).send({ error: "Food not found" });
    }

    // Get or create cart
    let cart = await cartsCollection.findOne({ userEmail: email });
    if (!cart) {
      cart = {
        userEmail: email,
        items: [],
        total: 0,
        itemCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.foodId === foodId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        foodId,
        foodName: food.foodName,
        foodImage: food.foodImage,
        price: food.price,
        quantity,
        category: food.category,
        availableQuantity: food.quantity
      });
    }

    // Recalculate totals
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();

    // Upsert cart
    await cartsCollection.updateOne(
      { userEmail: email },
      { $set: cart },
      { upsert: true }
    );

    res.send({ 
      success: true, 
      message: "Item added to cart",
      cart 
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).send({ error: "Failed to add item to cart" });
  }
});

module.exports = router;