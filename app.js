const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const xmlEscape = require('xml-escape');
const XMLParser = require('fast-xml-parser');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { JSDOM } = require('jsdom');

const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors()); //{origin:"https://grademelon.org"}
app.use(cors());
app.use(express.static('public'));

const encryptionKey = process.env.encryptionkey;
var apikey=generateKey();

function decryptDetails(password){
    const bytes = CryptoJS.AES.decrypt(password, encryptionKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return(originalText)
}

function getDateMMDDYY(inputDate=null,offset=0) {
  let date = !inputDate ? new Date() : new Date(inputDate.substring(0,2)+"/"+inputDate.substring(2,4)+"/"+inputDate.substring(4));
  const epoch=date.getTime();
  date=new Date(epoch+offset*1000*60*60*24)
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
    const today = getDateMMDDYY();
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
const gradingScales=new Map();
const backButton="<a href='javascript:window.history.back()'>back</a><br/>";

setInterval(()=>{
    apikey=generateKey();
},86400000);


function listFromRegion(date){
  try{
  if(!regions.has(date)){return("no such data")}
  const subregion=regions.get(date)
  let sendstring=`<h1>User Count ${date.substring(0,2)+"/"+date.substring(2,4)+"/"+date.substring(4)}</h1>`;
  let total=0;
  Array.from(subregion).forEach((school)=>{total+=school[1].size});
  sendstring+=`<br/><h2>Total: ${total}</h2>`
  sendstring+=`<br></br><a href="/userCount/${getDateMMDDYY(date,-1)}">Prev</a><br></br>`;
  sendstring+=`<a href="/userCount/${getDateMMDDYY(date,1)}">Next</a><br></br>`;
  return(sendstring+Array.from(subregion).map(region=>"<p>"+region[0]+": "+region[1].size+"</p>").join("<br>"));
  }
  catch(error){return(error.message)}
}


app.get("/",(req,res)=>{res.send(`<h1>GradeMelon API</h1><a href="/userCount/">User Count</a><br><a href="/gradeScales/">Grade Scales</a>`)})


app.get("/userCount/",(req,res)=>{
  try{

    res.send(backButton+listFromRegion(getDateMMDDYY()));
  }
  catch(error){res.send(error.message)}
})

app.get("/userCount/:date",(req,res)=>{
  const date=req.params.date;
  try{
    res.send(backButton+listFromRegion(date))
  }
  catch(error){console.log(error);res.send(backButton+"No data for this date")}
})



app.get("/gradeScales/",(req,res)=>{
  try{
      res.send(backButton+Array.from(gradingScales).map(region=>"<p>"+region[0]+": "+region[1]+"</p>").join("<br>"))
  }
  catch(error){res.send(backButton+error.message)}

})

app.post("/fulfillAxios",async(req,res)=>{
  try{
  const details=req.body;
    if(details.url!=="https://md-mcps-psv.edupoint.com/Service/PXPCommunication.asmx"){console.log(details);console.log("please god forgive me, for i am a sinner; i too have looked into the abyss and sought to join it.")}
  var parsedXml=parseXml(details.xml);
  if(details.encrypted){
    const password=decryptDetails(parsedXml.password);
    details.xml=details.xml.replace("<password>"+parsedXml.password+"</password>","<password>"+xmlEscape(password)+"</password>")
    parsedXml=parseXml(details.xml);
  }
  const sender={status:true}
  const headers={
    'Content-Type': 'text/xml',
    "Cookie":"edupointkeyversion="+apikey+";"
  }

  if(parsedXml.methodName=="Gradebook"){
    if(gradingScales.has(details.url.replace("/Service/PXPCommunication.asmx",""))){
      const gradingScale=gradingScales.get(details.url.replace("/Service/PXPCommunication.asmx",""));
      sender.gradingScale=gradingScale;
    }else{
      const cookies=await getSessionCookies({domain:details.url.replace("/Service/PXPCommunication.asmx","")});
      headers.Cookie+=cookies;

    }
    
    }
  

try{
  var response=await axios.post(details.url,details.xml,{headers:headers})}catch(error){var response=await axios.post(details.url,details.xml,{headers:headers})}
  sender.response=response.data;

  if(parsedXml.methodName=="Gradebook"&&!gradingScales.has(details.url.replace("/Service/PXPCommunication.asmx",""))){
    const raw=await getRawClassData({domain:details.url.replace("/Service/PXPCommunication.asmx",""),cookies:headers.Cookie}).catch();
    if(raw!=="failure"){
      var gradingScale=parseClassData(raw);
      gradingScales.set(details.url.replace("/Service/PXPCommunication.asmx",""),gradingScale);
      
    }
    else{
      var gradingScale=null;
    }
   
    sender.gradingScale=gradingScale;
  }
  res.json(sender);
  }catch(error){console.log(sanitizeError(error));res.json({status:false,message:error.message})}})


app.post("/logLogin",(req,res)=>{
  const details=req.body;
  const date=getDateMMDDYY();
  if(regions.has(date)){
  if(regions.get(date).has(details.schoolName)){regions.get(date).get(details.schoolName).add(details.username)}else{
    regions.get(date).set(details.schoolName,new Set([details.username]));
  }}
  else{
    regions.set(date,new Map());
    regions.get(date).set(details.schoolName,new Set([details.username]))


  }
  res.json({status:true})
})



app.post("/encryptPassword",(req,res)=>{
  const details=req.body;
  res.json({encryptedPassword:CryptoJS.AES.encrypt(details.password, encryptionKey).toString()})
})


function parseXml(xml){
  const parser = new XMLParser.XMLParser({});
  const result=parser.parse(xml);
  const parserTwo=new XMLParser.XMLParser({isArray: ()=>true,ignoreAttributes:false,processEntities:false,parseTagValue:false});
  return(result['soap:Envelope']['soap:Body'].ProcessWebServiceRequestMultiWeb)
}


async function getRawClassData(details){
      const url = details.domain+'/api/GB/ClientSideData/Transfer?action=genericdata.classdata-GetClassData';
      const data = new URLSearchParams({
            'FriendlyName': 'genericdata.classdata',
            'Method': 'GetClassData',
            'Parameters': '{}'
        });
        const headers = {
            'Origin': details.domain,
            'Referer': details.domain+'/PXP2_GradeBook.aspx?AGU=0',
            'Cookie':details.cookies
        };
 
            const response=await axios.post(url,data,{headers:headers}).catch(error=>{console.log("get raw class data fail");console.log(error);return "failure"});
                return(response.data);
    }



function parseClassData(data){
    const logging=data; //to be removed, only exists for logging purposes
  data=data.reportCardScoreTypes;
  const gradeScale={};
  var index;
  data.forEach((scale,aindex)=>{
    if(scale.name=="GenesisGrading"){
      index=aindex;
    }

  })
  if(index==undefined){return null}
  data[index].details.forEach(grade=>{
    console.log(grade)
      if(grade.lowScore>=0&&grade.highScore>=0){
        console.log("bullshit")
        gradeScale[grade.score]=[grade.lowScore,grade.highScore];

  }});

  if(!(Object.keys(gradeScale).length>0)){console.log("werid county");console.log(JSON.stringify(logging))} //temp logging to examine the variance across counties of the grading Scale index

  return Object.keys(gradeScale).length > 0 ? gradeScale : null;
}



async function getSessionCookies(details){ //gets valid session cookies
       url=details.domain+"/PXP2_Login_Student.aspx?regenerateSessionId=True";
      const response = await axios.get(url,{withCredentials:true}).catch(error=>{console.log("sessionCookies Fail");console.log(error);return "failure"});
      var cookies=response.headers['set-cookie'];
      var cookiestring="";
      cookies.map(cookie=>{return cookie.substring(0,cookie.indexOf(";"))}).forEach(cookie=>{cookiestring+=cookie+"; "})
      return(cookiestring);
            

}




app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g


