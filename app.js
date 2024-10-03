const express = require('express');
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const FormData = require('form-data');
const CryptoJS = require('crypto-js');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { JSDOM } = require('jsdom');
const slowDown = require("express-slow-down");


const app = express();


app.post("/fulfillAxios",async(req,res)=>{
  const details=req.body;
  const response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion=pLbL29JuBFfT2HwPdgcQQmZQVePkoGBBVsLaB0ztBQC/jGmbFGAFzaaqIjVo1lxv;"
          }})
  res.json(response.data);
})

app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
