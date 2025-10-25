const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../db');

// middleware for admin
const checkAdmin = async (req, res, next) => {
  try {
    const userEmail = req.headers['user-email'];
    if (!userEmail) {
      return res.status(401).send({ error: "User email required" });
    }

    const usersCollection = getDB().collection('users');
    const user = await usersCollection.findOne({ email: userEmail });

    if (!user || user.role !== 'admin') {
      return res.status(403).send({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    res.status(500).send({ error: "Authorization check failed" });
  }
};

// Get all foods
router.get('/', async (req, res) => {
  try {
    const foodsCollection = getDB().collection('foods');
    const cursor = foodsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    console.error("Get all foods error:", error);
    res.status(500).send({ error: "Failed to fetch foods" });
  }
});

// Get single food by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const foodsCollection = getDB().collection('foods');
    const query = { _id: new ObjectId(id) };
    const food = await foodsCollection.findOne(query);

    if (!food) {
      return res.status(404).send({ error: "Food not found" });
    }

    res.send(food);
  } catch (error) {
    console.error("Get food by ID error:", error);
    res.status(500).send({ error: "Failed to fetch food" });
  }
});

// Create new food
router.post('/', checkAdmin, async (req, res) => {
  try {
    const newFood = req.body;
    const foodsCollection = getDB().collection('foods');

    if (!newFood.addedBy || !newFood.addedBy.email) {
      return res.status(400).send({ error: 'addedBy information is required' });
    }

    newFood.purchaseCount = 0;
    const result = await foodsCollection.insertOne(newFood);
    res.send(result);
  } catch (error) {
    console.error("Create food error:", error);
    res.status(500).send({ error: "Failed to create food" });
  }
});

// Get user's foods
router.get('/my-foods/list', async (req, res) => {
  try {
    const userEmail = req.query.email;
    const foodsCollection = getDB().collection('foods');

    if (!userEmail) {
      return res.status(400).send({ error: 'User email required' });
    }

    const foods = await foodsCollection.find({ "addedBy.email": userEmail }).toArray();
    res.send(foods);
  } catch (error) {
    console.error("Get my foods error:", error);
    res.status(500).send({ error: "Failed to fetch user foods" });
  }
});

// Update food
router.put('/:id', checkAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    const foodsCollection = getDB().collection('foods');

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid food ID' });
    }

    const result = await foodsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: 'Food not found' });
    }

    res.send(result);
  } catch (error) {
    console.error('Update food error:', error);
    res.status(500).send({ error: 'Failed to update food' });
  }
});

// ADD THIS PATCH ENDPOINT FOR QUANTITY UPDATES
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { quantity, purchaseCount } = req.body;
    const foodsCollection = getDB().collection('foods');
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid food ID" });
    }
    
    const query = { _id: new ObjectId(id) };
    const update = {
      $set: {
        updatedAt: new Date()
      }
    };
    
    if (quantity !== undefined) {
      update.$set.quantity = parseInt(quantity);
    }
    
    if (purchaseCount !== undefined) {
      update.$set.purchaseCount = parseInt(purchaseCount);
    }
    
    const result = await foodsCollection.updateOne(query, update);
    
    if (result.modifiedCount === 1) {
      res.send({ 
        success: true,
        message: "Food quantity updated successfully" 
      });
    } else {
      res.status(404).send({ error: "Food not found" });
    }
  } catch (error) {
    console.error("Update food quantity error:", error);
    res.status(500).send({ error: "Failed to update food quantity" });
  }
});

module.exports = router;