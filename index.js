import express from 'express'
import 'dotenv/config'

import cors from 'cors';
import { MongoClient } from 'mongodb';
import { ObjectId } from 'mongodb';

import { createRemoteJWKSet, jwtVerify } from 'jose';

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
 const verifyToken = async(req, res, next) =>{
  const authHeader= req?.headers.authorization
  
    if(!authHeader){
    return res.status(401).json({message:
    "Unauthorized"
    });
  }
   console.log (authHeader, "auth")
 const token = authHeader.split(" ")[1];
  console.log(token)
 if(!token){
    return res.status(401).json({message:
       "Unauthorized"
    });
 }
//   JWKS set
const JWKS = createRemoteJWKSet(
 new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  )
// // payload in try catch
 try {
  
    // const JWKS = await getJWKS();   // <---- এই লাইনটি বসবে
 const { payload } = await jwtVerify(token, JWKS) 
   console.log(payload, "payload");
  //  newly added line for getting admin users
    req.user = payload; 
     next()
  } catch (error) {
     console.log(error);
     return res.status(403).json({message:
      "Forbidden"
      });
  }
 };
//  verification end

// // admin verify
const adminVerify = async(req, res, next) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({msg:"Forbidden"})
  }
   console.log('User from adminVerifytoken:', user);
  next()   
}


const mongoClient = await connectToMongoDB()
const db = mongoClient.db("full-project-client")
 const allEquipCollections = db.collection("addequipments");
const paymentCollection = db.collection("payment");
const userCollection = db.collection("user");
const wishlistCollections = db.collection("wishlist");
const OrderCollections = db.collection("bookings");

// For Homepage
// api for category
// category r array creation
app.get("/api/categories", async (req, res) => {
  try {
    // Product মডেল থেকে সব ডকুমেন্টের মধ্যে unique category নামগুলো বের করি
    const categories = await allEquipCollections
    .aggregate([
        { $group: { _id: "$category" } },   // ক্যাটাগরি অনুযায়ী গ্রুপ
        { $project: { _id: 0, name: "$_id" } } // ফরম্যাট ঠিক করা
      ])
      .toArray();
        res.status(200).json(categories);
  } catch (error) {
    console.error("Category Filter Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// product filter according to category
app.get("/api/products", async (req, res) => {
  try {
    // ইউআরএল থেকে query parameter নিয়ে নিই (যেমন: ?category=Electronics)
    const { category } = req.query;

    // ফিল্টার অবজেক্ট তৈরি করি
    //  let filter = { status: "Approved" };
  
    let filter = {status: "Approved"};
    if (category) {
      filter.category = category; // যদি category পাঠানো হয়, তাহলে শুধু ওই ক্যাটাগরির প্রোডাক্ট আনি
    }

    // ডাটাবেজ থেকে প্রোডাক্ট খুঁজি
    const products = await allEquipCollections.find(filter).toArray();

    // ফলাফল ক্লায়েন্টকে পাঠাই
    res.status(200).json(products);
  } catch (error) {
    console.error("Product Filter Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Featured section of home
app.get('/featured', async(req, res) =>{
const result = await allEquipCollections.find({status: "Approved"}).sort({ _id: -1 }).limit(6).toArray()
res.json(result);
 })



// owner api data
//  for add equipments
app.post('/owner/addequipments', async(req, res)=> {
  const addData = {...req.body, 
    createdAt: new Date(),
  }
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

    const query = {status: "Approved"};

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
// updated product api
 app.patch("/api/owner/:productId", async (req, res) => {
const {productId} = req.params
const updatedData = req.body
console.log(updatedData)
const result = await allEquipCollections.updateOne(
  {_id: new ObjectId(productId)},
  {$set: updatedData}
)
res.json(result)
 })

 // productId 
// param thake productId dhore for delete
app.delete("/api/owner/:productId", async(req, res) =>{
const {productId} = req.params;

// // //  if get id then go to mongodoc for delete query
// // // for particular id selection 
//  const query = {_id : new ObjectId(id)}
 const result = await allEquipCollections.deleteOne({_id:new ObjectId(productId)});

res.json(result)

});

// //  owner manageorders api
 app.get("/api/owner/orders", async(req, res)=>{
    
   const {ownerId} = req.query;
 const result = await OrderCollections.find({ownerId}) .sort({ createdAt: -1 }) .toArray();
 res.json(result)
})

// Equip Details page
app.get('/equipments/:id', verifyToken, async(req,res) =>{
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
// payment and success page
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

// payment r por Stock kome jabe
// 5. Atomically decrease availableStock by 1
// stock kome jasse start
 app.patch("/api/products/:id", async (req, res) => {
const {id} = req.params
// const updatedData = req.body
// console.log(updatedData)
// const result = await addproductCollection.updateOne(
//   {_id: new ObjectId(id)},
//   { $inc: { stock: -1 } }
// )
// res.json(result)

const { quantity } = req.body;
  const quantityNum = parseInt(quantity, 10);
  if (!quantityNum || quantityNum < 1) {
    return res.status(400).json({ message: 'Invalid quantity' });
  }

  try {
    const result = await allEquipCollections.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { stock: -quantityNum } } // কুয়ান্টিটি অনুযায়ী কমবে
  //      [
  //   { $set: { stock: { $subtract: [{ $toInt: "$stock" }, quantity] } } }
  // ]
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ Stockmessage: 'Server error' });
  }
});


// customer myrental and seller rental euipment page
// Orders for all
app.post('/api/orders', async(req,res) =>{
  const ordersData = req.body
  const result = await OrderCollections.insertOne(ordersData)
  res.json(result)
})
// code for session checking for duplicate order--

app.get('/api/orders', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // MongoDB তে চেক করা এই sessionId দিয়ে কোনো অর্ডার আছে কিনা
    const existingOrder = await OrderCollections.findOne({ sessionId });

    if (existingOrder) {
      // ফ্রন্টএন্ড অ্যারে আশা করছে, তাই অ্যারে রিটার্ন করছি
      return res.json([existingOrder]);
    } else {
      // অর্ডার না থাকলে খালি অ্যারে রিটার্ন করছি
      return res.json([]);
    }

  } catch (error) {
    console.error('❌ Error checking existing order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Customer order page a data ake payemnt orderdata thake asbe
app.get("/api/customer/myorders/:userId", async(req, res) => {
  // const { customerId } = req.query;
  // const  userId  = req.user?.id || customerId;
  // const result = await OrderCollections.find({ customerId:userId}).toArray();
  // res.json(result);
try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const result = await OrderCollections.find({ customerId: userId }).toArray();
    res.json(result);
  } catch (err) {
    console.error('❌ myorders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }

});
 

// buyerOreder page delete
   //   // for update bookingdelete 
 app.patch("/api/orders/:id", async(req, res) =>{
const {id} = req.params;
 const { orderStatus } = req.body;
//  console.log("placeId", id);
// //  if get id then go to mongodoc for delete query
// // for particular id selection 
// const query = {_id : new ObjectId(id)}

 // Validate the incoming status
    const validStatuses = ["pending", "approved", "cancelled"];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

const result = await OrderCollections.updateOne(
  {_id:new ObjectId(id)},
// { $set: { status: "cancelled"}}
{ $set: { orderStatus}}
)
// console.log(result);
res.json(result)

 });

 //  for customers wishlist 
app.post('/api/wishlist', async(req,res) =>{
 const { equipmentData, equipmentId, customerId} = req.body;
//  const { sessionId, status, customerEmail, metadata, createdAt } = req.body;
// const wishlistData = req.body;
const wishlistData = {
    equipmentData,
    equipmentId,
       customerId,
       
    addedAt: new Date()
  };
  console.log(wishlistData, "customers wishData");
  
  const result = await wishlistCollections.insertOne(wishlistData)
  res.json(result)
})
// Buyer wishlist page api. 1ta 1ta kore data phathano mongo thake
 app.get("/api/wishlist/:userId", async(req, res)=>{
    // res.send('hello server running')
  //  const {customerId} = req.query;
   const userId = req.user?.id || req.params.userId || req.query?.customerId;
  //  const userId = req.user?.id;
  //  const {productId} =req.body;
  //  const {productId} = productData._id;
   console.log('buyerwishlistuserId', userId)
const result = await wishlistCollections.find({customerId: userId }).toArray();
 res.json(result)
})

// wishlist delete
app.delete("/api/wishlist/:id", async(req, res) =>{
const {id} = req.params;
console.log(req.params, "wishlistdeleteid")

// // //  if get id then go to mongodoc for delete query
// // // for particular id selection 
//  const query = {_id : new ObjectId()}
 const result = await wishlistCollections.deleteOne({_id:new ObjectId(id)});

res.json(result)
 })

//  Admin  Admin >>>>>>Admin>>
// allequipments
app.get('/api/admin/products/all', async (req, res) => {

  const result = await allEquipCollections.find({}).toArray();
  res.json(result);
});
// // title dia search
// app.get('/api/admin/products', async (req, res) =>{
// const {title} = req.query;
// const result = await allEquipCollections.find({title}).toArray();
// res.json(result) 
//  }); 

// admin all orders(search sara)
app.get('/api/admin/allorders', async (req, res) => {

  const result = await OrderCollections.find({}).toArray();
  res.json(result);
});
 


//  Admin products update for pending and approved
app.patch("/api/products/status/:adminproductid", async (req, res) => {
const {adminproductid} = req.params;
const updatedAdminProductData = req.body
console.log(updatedAdminProductData, "adminupdatedproduct")

 const filter = {_id: new ObjectId(adminproductid)};
 const updatedAdminStatus = {
 $set: {
  status: updatedAdminProductData.status
  }
}
const result = await allEquipCollections.updateOne(filter,updatedAdminStatus) 
res.json(result);
 })

//  Admin product edit (name / price / category)
app.patch("/api/admin/:adminproductid", async (req, res) => {
  try {
    const { adminproductid } = req.params;
    const updates = req.body || {};

    const allowed = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.equipmentName !== undefined) allowed.equipmentName = updates.equipmentName;
    if (updates.category !== undefined) allowed.category = updates.category;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.price !== undefined) {
      const price = Number(updates.price);
      if (Number.isNaN(price)) return res.status(400).json({ message: "Invalid price" });
      allowed.price = price;
    }

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const result = await allEquipCollections.updateOne(
      { _id: new ObjectId(adminproductid) },
      { $set: allowed }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("admin product edit error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

//  admin rejected power
app.delete("/api/admin/:rejectedproductid", async(req, res) =>{
const {rejectedproductid} = req.params;

// // //  if get id then go to mongodoc for delete query
// // // for particular id selection 
//  const query = {_id : new ObjectId()}
 const result = await allEquipCollections.deleteOne({_id:new ObjectId(rejectedproductid)});

res.json(result)
 })


//Admin rental/order management api
   app.get("/api/admin/allorders", async(req, res)=>{

  // search
  try {
    const { orderId, search } = req.query;

    let filter = {};

    // 🔹 _id দিয়ে search
    if (orderId && orderId.trim() !== '') {
      if (ObjectId.isValid(orderId)) {
        filter._id = new ObjectId(orderId);
      } else {
        return res.status(400).json({ message: 'Invalid orderId' });
      }
    }

    // 🔹 text search (title / orderStatus / customerEmail / buyerName ইত্যাদি)
    if (search && search.trim() !== '') {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title:       { $regex: safeSearch, $options: 'i' } },
        { orderStatus: { $regex: safeSearch, $options: 'i' } },
       
        { customerName:   { $regex: safeSearch, $options: 'i' } },
        { ownerName:  { $regex: safeSearch, $options: 'i' } },
        { productId:   { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const result = await OrderCollections
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// admin user manage page
app.get("/api/admin/users",verifyToken, adminVerify, async(req, res)=>{
    // res.send('hello server running')
  //  const {userId} = req.query;
//   const result = await userCollection.find({ role: { $ne: 'admin'}}).toArray();
//  res.json(result)
  try {
    const { search } = req.query; // কুয়েরি থেকে search নিন

    let filter = { role: { $ne: 'admin' } }; // অ্যাডমিন বাদ

    // যদি search থাকে, তাহলে নাম বা ইমেইলে খুঁজুন
    if (search && search.trim() !== '') {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await userCollection.find(filter).toArray();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
})
// 
// app.patch(
//   "/api/admin/user/:userId/role",
//   verifyToken,
//   adminVerify,
//   async (req, res) => {
//     console.log("HIT:", req.params.userId, req.body);  // debug
//     const { userId } = req.params;
//     const { role } = req.body;

//     if (!["customer", "admin", "owner"].includes(role)) {
//       return res.status(400).json({ message: "Invalid role" });
//     }
//     // নিজের role বদলানো block
//     if (req.user.id === userId) {
//       return res.status(403).json({ message: "Cannot change own role" });
//     }

//     await userCollection.updateOne(
//       { _id: new ObjectId(userId) },
//       { $set: { role } }
//     );
//     res.json({ success: true });
//   }
// );
// users updated by admin
// অ্যাডমিন ইউজার ব্লক/আনব্লক করার রাউট
app.patch("/api/admin/user/:id/role", verifyToken, adminVerify, async (req, res) => {
 
    const { id } = req.params;
    const query = {_id: new ObjectId(id)};
    const updatedDoc = {
      $set:{
        role:req.body.role,
      }
    }

    // MongoDB-তে আপডেট করো (এখানে user ভেরিয়েবল লাগবে না, ডাইরেক্ট আপডেট)
    const result = await userCollection.updateOne(query, updatedDoc);
    res.send(result)
  });
// auth middleware (আপনার existing auth system-এর সাথে adjust করুন)
const requireAdmin = (req, res, next) => {
  const user = req.user;               // auth middleware থেকে আসা user
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can change roles" });
  }
  next();
};

app.patch("/api/admin/user/:id/role", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["customer", "admin", "owner"];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // 1) নিজের role নিজে change করা যাবে না (lockout প্রতিরোধ)
    const currentUserId = req.user.id || req.user._id;
    if (String(currentUserId) === String(id)) {
      return res
        .status(403)
        .json({ message: "You cannot change your own role" });
    }

    const query = { _id: new ObjectId(id) };
    const existing = await userCollection.findOne(query);
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2) শেষ admin-কে demote করা যাবে না
    if (existing.role === "admin" && role !== "admin") {
      const adminCount = await userCollection.countDocuments({
        role: "admin",
      });
      if (adminCount <= 1) {
        return res
          .status(403)
          .json({ message: "Cannot demote the last admin" });
      }
    }

    // (আপনার আগের "owner cannot be changed" block সরিয়ে দেওয়া হয়েছে,
    //  কারণ আপনার logic অনুযায়ী admin সব role-ই পরিবর্তন করতে পারে)

    await userCollection.updateOne(query, { $set: { role } });

    return res.status(200).json({ message: `User role updated to ${role}` });
  } catch (err) {
    console.error("Role update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});
   








app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})