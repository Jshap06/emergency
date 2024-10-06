const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors());
app.use(cors());

const encryptionKey = process.env.encryptionkey;

function decryptDetails(details){
    const bytes = CryptoJS.AES.decrypt(details.password, encryptionKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return(originalText)
}


app.post("/fulfillAxios",async(req,res)=>{
  try{
  const details=req.body;
  if(details.encrypted){
    const password=decryptDetails(details);
    console.log(password);
    details.xml=details.xml.replace(details.password,password)
    console.log(details.xml);
  }
  const response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion=28IFf99zrVnC65SsQ3KsuCvyvYrgaEsW2tsmmeIlKuQOkrPHcumiGfmWcb8Lfvyw;"
          }})
  res.json({status:true,response:response.data});
  }catch(error){console.log(error);res.json({status:false,message:error.message})}})

app.post("/encryptPassword",(req,res)=>{
  const details=req.body;
  res.json({encrpytedPassword:CryptoJS.AES.encrypt(details.password, encryptionKey).toString()})
})

app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g
