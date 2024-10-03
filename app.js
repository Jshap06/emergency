const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors());


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
//g
