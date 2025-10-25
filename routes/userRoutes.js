const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../db');

// Get user by email (check if user exists)
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const usersCollection = getDB().collection('users');
    
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    
    // Don't send sensitive data
    const { password, ...safeUser } = user;
    res.send(safeUser);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).send({ error: "Failed to fetch user" });
  }
});

// Create or update user (during registration)
router.post('/', async (req, res) => {
  try {
    const userData = req.body;
    const usersCollection = getDB().collection('users');
    
    console.log("Received user data:", userData);

    // Required fields validation
    if (!userData.email || !userData.uid) {
      return res.status(400).send({ error: "Email and UID are required" });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: userData.email });
    
    if (existingUser) {
      // Update existing user
      const result = await usersCollection.updateOne(
        { email: userData.email },
        { 
          $set: { 
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            lastLogin: new Date()
          } 
        }
      );
      res.send({ message: "User updated", user: existingUser });
    } else {
      // Create new user with default role as 'customer'
      const newUser = {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        role: userData.role || 'customer',
        createdAt: new Date(),
        lastLogin: new Date(),
        profile: {
          phone: '',
          address: '',
          bio: ''
        }
      };

      console.log("Creating new user:", newUser);

      const result = await usersCollection.insertOne(newUser);
      res.send({ message: "User created successfully", user: newUser });
    }
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).send({ error: "Failed to create user: " + error.message });
  }
});

// Update user profile
router.put('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const updateData = req.body;
    const usersCollection = getDB().collection('users');

    const result = await usersCollection.updateOne(
      { email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    res.send({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).send({ error: "Failed to update user" });
  }
});

// Update user role (admin only - add authentication later)
router.patch('/:email/role', async (req, res) => {
  try {
    const email = req.params.email;
    const { role } = req.body;
    const usersCollection = getDB().collection('users');

    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).send({ error: "Invalid role" });
    }

    const updateData = {
      role,
      ...(role === 'admin' && {
        adminAccess: {
          permissions: ['manage_users', 'manage_foods', 'view_analytics'],
          isSuperAdmin: false
        }
      })
    };

    const result = await usersCollection.updateOne(
      { email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    res.send({ message: `Role updated to ${role}` });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).send({ error: "Failed to update role" });
  }
});

// Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const users = await usersCollection.find({}).toArray();
    
    // Remove sensitive data
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.send(safeUsers);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).send({ error: "Failed to fetch users" });
  }
});

router.patch('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const updates = req.body;
    const usersCollection = getDB().collection('users');
    
    console.log("PATCH request for user:", email, "with updates:", updates);

    if (!email) {
      return res.status(400).send({ error: "Email parameter is required" });
    }

    // Remove any undefined fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    const query = { email: email };
    const update = {
      $set: {
        ...cleanUpdates,
        updatedAt: new Date()
      }
    };
    
    console.log("Update query:", query);
    console.log("Update data:", update);
    
    const result = await usersCollection.updateOne(query, update);
    
    console.log("Update result:", result);
    
    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    // Return the updated user
    const updatedUser = await usersCollection.findOne(query);
    const { password, ...safeUser } = updatedUser;
    
    res.send({
      message: "User updated successfully",
      user: safeUser
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).send({ error: "Failed to update user: " + error.message });
  }
});

module.exports = router;