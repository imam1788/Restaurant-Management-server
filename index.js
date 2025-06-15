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
      const purchaseData = req.body;
      purchaseData.date = Date.now();
      const result = await purchasesCollection.insertOne(purchaseData);
      res.send(result);
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

    // Delete purchase by ID
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