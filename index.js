require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.90j6q9g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const foodsCollection = client.db('restaurantManagementDB').collection('foods');

    const purchasesCollection = client.db('restaurantManagementDB').collection('purchases');

    app.get('/foods', async (req, res) => {
      const cursor = foodsCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/foods/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const food = await foodsCollection.findOne(query);
      res.send(food);
    });

    app.post('/purchase', async (req, res) => {
      try {
        const purchase = req.body;

        if (!purchase?.foodId || !purchase?.quantity || !purchase?.buyerEmail) {
          return res.status(400).send({ error: "Missing required purchase fields" });
        }

        const food = await foodsCollection.findOne({ _id: new ObjectId(purchase.foodId) });

        if (!food) {
          return res.status(404).send({ error: "Food not found" });
        }

        // Prevent self-purchase
        if (food.addedBy?.email === purchase.buyerEmail) {
          return res.status(403).send({ error: "You cannot purchase your own food item" });
        }

        // Check quantity availability
        const requestedQty = parseInt(purchase.quantity);
        if (food.quantity === 0) {
          return res.status(400).send({ error: "Item is not available (quantity 0)" });
        }

        if (requestedQty > food.quantity) {
          return res.status(400).send({ error: `Only ${food.quantity} items are available` });
        }

        // Proceed with purchase
        purchase.date = new Date();

        const result = await purchasesCollection.insertOne(purchase);

        // Update food quantity and purchase count
        await foodsCollection.updateOne(
          { _id: new ObjectId(purchase.foodId) },
          {
            $inc: {
              quantity: -requestedQty,
              purchaseCount: requestedQty
            }
          }
        );

        res.send({ success: true, message: "Purchase successful", result });
      } catch (error) {
        console.error("Purchase failed:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });


    app.get('/purchase', async (req, res) => {
      const buyerEmail = req.query.buyerEmail;
      if (!buyerEmail) {
        return res.status(400).send({ error: "buyerEmail query parameter is required" });
      }
      const query = { buyerEmail };
      const purchases = await purchasesCollection.find(query).toArray();
      res.send(purchases);
    });

    app.delete('/purchase/:id', async (req, res) => {
      const id = req.params.id;
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
    });

    app.post('/foods', async (req, res) => {
      const newFood = req.body;

      if (!newFood.addedBy || !newFood.addedBy.email) {
        return res.status(400).send({ error: 'addedBy information is required' });
      }
      newFood.purchaseCount = 0;
      const result = await foodsCollection.insertOne(newFood);
      res.send(result);
    });


    app.get('/my-foods', async (req, res) => {
      const userEmail = req.query.email;
      if (!userEmail) return res.status(400).send({ error: 'User email required' });

      const foods = await foodsCollection.find({ "addedBy.email": userEmail }).toArray();
      res.send(foods);
    });

    app.put('/foods/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        console.log("PUT called for ID:", id);
        console.log("Updated Data:", updatedData);

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
        console.error('PUT /foods/:id error:', error);
        res.status(500).send({ error: 'Server error while updating food' });
      }
    });





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Restaurant Management Server is Running!');
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});