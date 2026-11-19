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


app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})