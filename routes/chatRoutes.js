const express = require('express');
const router = express.Router();
const { getDB, ObjectId } = require('../db');

// Get admin users
const getAdminEmails = async (db) => {
  try {
    const adminUsers = await db.collection('users')
      .find({ role: 'admin' })
      .project({ email: 1 })
      .toArray();
    return adminUsers.map(user => user.email);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return ['admin@tastehub.com'];
  }
};

// Send a message
router.post('/messages/send', async (req, res) => {
  try {
    const { senderEmail, senderName, text, file, isAdmin, targetEmail } = req.body;
    const db = getDB();

    // Get actual admin emails
    const adminEmails = await getAdminEmails(db);
    const primaryAdminEmail = adminEmails[0] || 'admin@tastehub.com';

    // Determine receiver email
    let receiverEmail;
    if (isAdmin) {
      receiverEmail = targetEmail; // Admin sending to customer
    } else {
      receiverEmail = primaryAdminEmail; // Customer sending to admin
    }

    const newMessage = {
      senderEmail,
      senderName,
      receiverEmail,
      text,
      file: file || null,
      isAdmin: Boolean(isAdmin),
      isRead: false,
      timestamp: new Date()
    };

    // Save message
    const result = await db.collection('chatMessages').insertOne(newMessage);
    const savedMessage = { ...newMessage, _id: result.insertedId };

    // Update or create conversation
    const customerEmail = isAdmin ? targetEmail : senderEmail;
    
    await db.collection('conversations').updateOne(
      { customerEmail },
      {
        $set: {
          customerEmail,
          customerName: senderName,
          lastMessage: text,
          lastMessageTime: new Date(),
          adminAssigned: primaryAdminEmail,
          updatedAt: new Date()
        },
        $inc: { 
          // Increase unread count for the RECEIVER
          unreadCount: isAdmin ? 1 : 0 // Admin messages to customer are unread for customer
        }
      },
      { upsert: true }
    );

    res.send({ message: "Message sent", chatMessage: savedMessage });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).send({ error: "Failed to send message: " + error.message });
  }
});

// Get messages for a specific user
router.get('/messages/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const db = getDB();

    const messages = await db.collection('chatMessages')
      .find({
        $or: [
          { senderEmail: userEmail },
          { receiverEmail: userEmail }
        ]
      })
      .sort({ timestamp: 1 })
      .toArray();
    
    res.send(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).send({ error: "Failed to fetch messages" });
  }
});

// Get all conversations for admin
router.get('/admin/conversations', async (req, res) => {
  try {
    const db = getDB();
    
    const conversations = await db.collection('conversations')
      .find()
      .sort({ lastMessageTime: -1 })
      .toArray();
    
    res.send(conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).send({ error: "Failed to fetch conversations" });
  }
});

// Mark customer messages as read (when customer opens chat)
router.put('/messages/read/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;
    const db = getDB();
    
    console.log("🟡 Marking ALL messages as read for customer:", customerEmail);

    // Mark ALL unread messages sent to this customer as read
    const result = await db.collection('chatMessages').updateMany(
      { 
        receiverEmail: customerEmail, // Messages sent TO the customer
        isRead: false
      },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date() 
        } 
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} messages as read for customer`);

    // Also update conversation unread count to 0
    await db.collection('conversations').updateOne(
      { customerEmail: customerEmail },
      { 
        $set: { 
          unreadCount: 0,
          updatedAt: new Date() 
        } 
      }
    );

    res.send({ 
      success: true,
      message: 'Messages marked as read', 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error("❌ Mark messages read error:", error);
    res.status(500).send({ error: "Failed to mark messages as read" });
  }
});

// NEW: Mark admin messages as read (when admin opens conversation)
router.put('/admin/messages/read/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;
    const db = getDB();
    
    console.log("🟡 Marking admin messages as read for conversation:", customerEmail);

    // Get admin emails
    const adminEmails = await getAdminEmails(db);

    // Mark messages from customer to admin as read
    const result = await db.collection('chatMessages').updateMany(
      { 
        senderEmail: customerEmail, // Messages FROM customer
        receiverEmail: { $in: adminEmails }, // Messages TO any admin
        isRead: false
      },
      { 
        $set: { 
          isRead: true, 
          readAt: new Date() 
        } 
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} admin messages as read`);

    // Update conversation unread count to 0
    await db.collection('conversations').updateOne(
      { customerEmail: customerEmail },
      { 
        $set: { 
          unreadCount: 0,
          updatedAt: new Date() 
        } 
      }
    );

    res.send({ 
      success: true,
      message: 'Admin messages marked as read', 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error("❌ Mark admin messages read error:", error);
    res.status(500).send({ error: "Failed to mark admin messages as read" });
  }
});

// Get unread count for customer
router.get('/unread-count/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const db = getDB();
    
    // Count messages sent TO the user that are unread
    const unreadCount = await db.collection('chatMessages')
      .countDocuments({
        receiverEmail: userEmail,
        isRead: false
      });
    
    console.log(`🔵 Unread count for ${userEmail}: ${unreadCount}`);
    res.send({ unreadCount });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).send({ error: "Failed to get unread count" });
  }
});

// Get admin total unread count - FIXED
router.get('/admin/total-unread', async (req, res) => {
  try {
    const db = getDB();
    const adminEmails = await getAdminEmails(db);
    
    // Count messages sent TO admin that are unread
    const totalUnread = await db.collection('chatMessages')
      .countDocuments({
        receiverEmail: { $in: adminEmails },
        isRead: false
      });
    
    console.log(`🔵 Total unread messages for admin: ${totalUnread}`);
    res.send({ totalUnread });
  } catch (error) {
    console.error("Get admin total unread error:", error);
    res.status(500).send({ error: "Failed to get admin unread count" });
  }
});

module.exports = router;