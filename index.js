const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bihlgkr.mongodb.net/?retryWrites=true&w=majority`;

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


    const dataCollection = client.db('summerCampDb').collection('data');
    const classCollection = client.db('summerCampDb').collection('classes');

    app.get('/instructors', async(req, res)=>{
        const result = await dataCollection.find().toArray();
        res.send(result)
    })

    app.get('/classes', async (req, res)=>{
      const email = req.query.email;
      if(!email){
        res.send([]);
      }
      const query = {email: email};
      const result = await classCollection.find(query).toArray();
      res.send(result)
    })
    
    // Selected Class Collection
    app.post('/classes', async(req, res)=>{
      const selected = req.body;
      console.log(selected);
      const result = await classCollection.insertOne(selected);
      res.send(result)
    })
    
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res)=>{
    res.send('school is open')
}) 
app.listen(port, ()=>{
    console.log(`School camping server is running on port ${port}`);
})