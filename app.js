const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const xmlEscape = require('xml-escape');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors()); //{origin:"https://grademelon.org"}
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
    let keyBytes = CryptoJS.enc.Utf8.parse('b2524efb438b4532b322e633d5aff252');  // Convert key to a word array
    let ivBytes = CryptoJS.enc.Utf8.parse('AES');  // Convert IV to a word array

    console.log("Key Bytes: ", keyBytes);
    console.log("IV Bytes: ", ivBytes);

    // Define the input string (date, version, etc.)
    const today = getCurrentDateMMDDYYYY();
    let input = `${today}|8.7.0|${today}|android`;

    // Encrypt the input string using AES with CBC mode and PKCS7 padding
    let encrypted = CryptoJS.AES.encrypt(input, keyBytes, {
      iv: ivBytes,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Convert the encrypted data to a Base64 string
    let encryptedString = encrypted.toString();

    console.log('API Key:', encryptedString);
    return encryptedString;
  } catch (error) {
    console.error(error);
  }
}

function sanitizeError(error) {
  var { message, stack, name } = error; // Only select essential properties
  message=message.replace(/<password>.*?<\/password>/,"<password>redacted</password>");
  stack=stack.replace(/<password>.*?<\/password>/,"<password>redacted</password>");
  name=name.replace(/<password>.*?<\/password>/,"<password>redacted</password>");
  // Redact or transform any sensitive details here if needed
  return { name, message, stack };
}

const regions=new Map();
const regionURLs=[];


setInterval(()=>{
    apikey=generateKey();
},86400000);



app.get("/userCount/",(req,res)=>{
  try{
      res.send(Array.from(regions).map(region=>"<p>"+region[0]+": "+region[1].size+"</p>").join("<br>"))
  }
  catch(error){res.send(error.message)}
})



app.post("/fulfillAxios",async(req,res)=>{
  try{
  const details=req.body;
  if(details.encrypted){
    const password=decryptDetails(details);
    details.xml=details.xml.replace("<password>"+details.password+"</password>","<password>"+xmlEscape(password)+"</password>")
  }
try{
  var response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion="+apikey+";"
          }})}catch(error){  var response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion="+apikey+";"
          }})}
  res.json({status:true,response:response.data});
  }catch(error){console.log(error.replace(/<password>.*?<\/password>/,"<password>redacted</password>"));res.json({status:false,message:error.message})}})


app.post("/logLogin",(req,res)=>{
  const details=req.body;
  if(regions.has(details.schoolName)){regions.get(details.schoolName).add(details.username)}else{
    regions.set(details.schoolName,new Set([details.username]));
  }
  res.json({status:true})
})
app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g


