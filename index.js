const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  };
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bihlgkr.mongodb.net/?retryWrites=true&w=majority&ssl=true`;


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


    const usersCollection = client.db('summerCampDb').collection('users');
    const dataCollection = client.db('summerCampDb').collection('data');
    const classCollection = client.db('summerCampDb').collection('classes');
    const paymentCollection = client.db('summerCampDb').collection('payments');


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      })
      res.send({ token })
    })


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }


    app.get('/users', verifyJWT, verifyAdmin, verifyInstructor, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const result = { instructor: user?.role === 'instructor' }
      res.send(result)
    })


    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.get('/instructors', async (req, res) => {
      const result = await dataCollection.find().toArray();
      res.send(result)
    })

    app.get('/instructors', verifyJWT, async (req, res) => {
      const requestedEmail = req.query.email;
      console.log(requestedEmail);
      if (!requestedEmail) {
        res.send([]);
      }
    
      const decodedEmail = req.decoded.email;
      if (requestedEmail !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
    
      const query = { instructor_email: requestedEmail };
      const result = await dataCollection.find(query).toArray();
      res.send(result);
    });


    



    app.post('/instructors', async (req, res) => {
      const classData = req.body;
      const result = await dataCollection.insertOne(classData)
      res.send(result)
    })

    app.get('/classes', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result)
    })


    app.post('/classes', async (req, res) => {
      try {
        const { Class, email } = req.body;
        console.log(Class);

        const newClass = {
          ...Class

        };

        newClass.email = email;

        const result = await classCollection.insertOne(newClass);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing the request.');
      }
    });


    app.delete('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result)
    })


    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/enrolled', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if(!email){
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
    })



    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const class_id = payment.class_id;
      console.log('class_id', class_id);

      const insertResult = await paymentCollection.insertOne(payment)
      const query = { class_id: class_id };

      const deleteResult = await classCollection.deleteMany(query)
      const filter = { "classes.class_id": class_id };
      console.log('Filter:', filter);
      const updateDoc = {
        $inc: {
          "classes.$.seats": -1,
          "classes.$.students": 1,
        },
      };

      console.log('Update Doc:', updateDoc);
      const result = await dataCollection.updateOne(filter, updateDoc);
      console.log('Update Result:', result);
      res.send({ insertResult, deleteResult, result })
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




app.get('/', (req, res) => {
  res.send('school is open')
})
app.listen(port, () => {
  console.log(`School camping server is running on port ${port}`);
})