import express from 'express'
import 'dotenv/config'

import cors from 'cors';
import { MongoClient } from 'mongodb';
import { ObjectId } from 'mongodb';

// import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express()
app.use(express.json());
const PORT = 5000
app.use(cors())

const client = new MongoClient(process.env.MONGO_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


// verify Token
//  const verifyToken = async(req, res, next) =>{
//   const authHeader= req?.headers.authorization
  
//     if(!authHeader){
//     return res.status(401).json({message:
//     "Unauthorized"
//     });
//   }
//    console.log (authHeader, "auth")
//  const token = authHeader.split(" ")[1];
//   console.log(token)
//  if(!token){
//     return res.status(401).json({message:
//        "Unauthorized"
//     });
//  }
//  // verification by JWKS
// const JWKS = createRemoteJWKSet(
//  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
//   )
// // // payload in try catch
//  try {
  
//     // const JWKS = await getJWKS();   // <---- এই লাইনটি বসবে
//  const { payload } = await jwtVerify(token, JWKS) 
//    console.log(payload, "payload");
//      next()
//   } catch (error) {
//      console.log(error);
//      return res.status(403).json({message:
//       "Forbidden"
//       });
//   }
//  };
//  verification end
const mongoClient = await connectToMongoDB()
const db = mongoClient.db("full-project-client")
 const allEquipCollections = db.collection("addequipments");
const paymentCollection = db.collection("payment");
const userCollection = db.collection("user");
const wishlistCollections = db.collection("wishlist");


//  for add equipments
app.post('/owner/addequipments', async(req, res)=> {
  const addData = req.body
  const result = await allEquipCollections.insertOne(addData)
  console.log("serveradddata", result)
  res.send({message: "Add api working"})
})

//  for all equipments
app.get('/allequipments', async (req, res) => {
  console.log("🔍 Full query params:", req.query);
  try {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();

    const query = {};

    // 🔎 নাম দিয়ে search (title = legacy shape, equipmentName = current shape)
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: safe, $options: 'i' };
      query.$or = [{ title: regex }, { equipmentName: regex }];
    }

    // 📂 category filter (case-insensitive exact match)
    if (category && category !== "all") {
      query.category = { $regex: `^${category}$`, $options: 'i' };
    }

    console.log("📝 Search query:", query);

    const result = await allEquipCollections
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    console.log("✅ Found:", result.length, "All epuipments from data");
    res.json(result);
  } catch (error) {
    console.error('Error in /allequipments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Equip Details page
app.get('/equipments/:id', async(req,res) =>{
  const {id} =req.params;
  const result = await allEquipCollections.findOne({_id:new ObjectId(id)})
 console.log(id, 'equipid')
// newly added
if (!result) {
  return res.status(404).json({ error: 'Equip not found' });  // ⭐ এটা দিন
}
  // res.json(result)
  res.status(200).json(result);
})

// for owner myequipments page
// Manage page
 app.get('/owner/myequipments/:ownerId', async(req, res) => {
   const {ownerId} = req.params;
   console.log(ownerId,"userId for my-event")

const result= await allEquipCollections.find({ownerId:ownerId}).toArray()
res.send(result);
 })

// // for deleted
// app.delete("/manage/:userId", async(req, res) =>{
// const {userId } = req.params;
//  const result = await  allEventsCollections.deleteOne({_id:new ObjectId(userId)});

// res.json(result)

// });
// // for Update
//  app.patch("/manage/:id", async (req, res) => {
// const {id} = req.params
// const updatedData = req.body
// console.log(updatedData, 'server updated data')
// const result = await  allEventsCollections.updateOne(
//   {_id: new ObjectId(id)},
//   {$set: updatedData}
// )
// res.json(result)
//  })


// for customers
// bookings page
app.post("/api/checkout_sessions", async (req, res) => {
  try {
    const paymentData = req.body;
    console.log(paymentData, 'serverCustomersPaymentData');

    // ✅ ভ্যালিডেশন (চেক করুন sessionId আছে কিনা, নাহলে ডুপ্লিকেট এড়াতে)
    if (!paymentData.sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
console.log(paymentData.sessionId, "paymentId")
 // ডুপ্লিকেট চেক (যদিও unique index থাকলেও এটি optional)
    const existing = await paymentCollection.findOne({ sessionId: paymentData.sessionId });
    if (existing) {
      return res.status(409).json({ error: 'Payment already exists' });
    }

    const result = await paymentCollection.insertOne(paymentData);
  //   //  res.json(result)
  //   // ✅ সফল হলে রেসপন্স পাঠান
    res.status(201).json(result);
    
  } catch (error) {
  // //   // ❌ এরর হলেও কিন্তু রেসপন্স পাঠাতে হবে, নাহলে ক্লায়েন্ট হ্যাং করবে!
    console.error('❌ Payment save error:', error.message);
    
  // //   // ডুপ্লিকেট এরর (E11000) হ্যান্ডেল করুন
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Payment already exists' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// payment page a data pahathano 1ta 1ta kore
app.get("/api/customer/payment", async (req, res) => {
  try {
    const { customerEmail} = req.query;  // ✅ query থেকে নিন

    if (!customerEmail) {
      return res.status(400).json({ error: "customerEmail is required" });
    }

    // customerEmail দিয়ে payment collection-এ খুঁজুন (সরাসরি ফিল্ড)
    const result = await paymentCollection.find({ customerEmail }).toArray();
      res.json(result);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}); 

app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})