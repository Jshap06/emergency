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
const gradingScales=new Map();


setInterval(()=>{
    apikey=generateKey();
},86400000);



app.get("/userCount/",(req,res)=>{
  try{
      res.send(Array.from(regions).map(region=>"<p>"+region[0]+": "+region[1].size+"</p>").join("<br>"))
  }
  catch(error){res.send(error.message)}
})

app.get("/gradeScales/",(req,res)=>{
  try{
      res.send(Array.from(gradingScales).map(region=>"<p>"+region[0]+": "+region[1]+"</p>").join("<br>"))
  }
  catch(error){res.send(error.message)}

})

app.post("/fulfillAxios",async(req,res)=>{
  try{
  const details=req.body;
  var parsedXml=parseXml(details.xml);
  if(details.encrypted){
    const password=decryptDetails(parsedXml.password);
    details.xml=details.xml.replace("<password>"+parsedXml.password+"</password>","<password>"+xmlEscape(password)+"</password>")
    parsedXml=parseXml(details.xml);
  }



try{
  var response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion="+apikey+";"
          }})}catch(error){  var response=await axios.post(details.url,details.xml,{headers: {
            'Content-Type': 'text/xml',
            "Cookie":"edupointkeyversion="+apikey+";"
          }})}
  const sender={status:true,response:response.data}
  if(parsedXml.methodName=="Gradebook"){
    if(gradingScales.has(details.url.replace("/Service/PXPCommunication.asmx",""))){
      const gradingScale=gradingScales.get(details.url.replace("/Service/PXPCommunication.asmx",""));
      sender.gradingScale=gradingScale;
    }else{
      let scale=await getGradeScale({domain:details.url.replace("/Service/PXPCommunication.asmx",""),username:parsedXml.userID,password:parsedXml.password})
      if(scale!=="failure"){
        gradingScales.set(details.url.replace("/Service/PXPCommunication.asmx",""),scale);}
      sender.gradingScale=(scale && scale!=="failure") ? scale:null;
    }
    
    }
    
    
  res.json(sender);
  }catch(error){console.log(sanitizeError(error));res.json({status:false,message:error.message})}})


app.post("/logLogin",(req,res)=>{
  const details=req.body;
  if(regions.has(details.schoolName)){regions.get(details.schoolName).add(details.username)}else{
    regions.set(details.schoolName,new Set([details.username]));
  }
  res.json({status:true})
})


const viewStates=new Map()

setInterval(async ()=>{
  for(const [domain,states] of viewStates.entries()){
    await axios.get(domain+"/PXP2_Login_Student.aspx?regenerateSessionId=True").then(response=>{
        const [VIEWSTATE, EVENTVALIDATION]=parseFormData(response.data);
    viewStates.set(domain,[VIEWSTATE,EVENTVALIDATION])}).catch(error=>{console.log(error);})}
    
  
  
},21600000)

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

async function logIn(details,session) {
  return new Promise(async (res, rej)=>{
  const url = details.domain+"/PXP2_Login_Student.aspx?regenerateSessionId=True";
  try{
  if(!viewStates.has(details.domain)){
  console.log("another axios")
  const response2 = await axios.get(url).catch(error=>{return rej(error)})
  const [VIEWSTATE, EVENTVALIDATION]=parseFormData(response2.data);
  viewStates.set(details.domain,[VIEWSTATE,EVENTVALIDATION])}
  const data = new FormData();
  
  data.append('__VIEWSTATE', viewStates.get(details.domain)[0]);
  data.append('__EVENTVALIDATION', viewStates.get(details.domain)[1]);
  data.append('ctl00$MainContent$username', details.username);
  data.append('ctl00$MainContent$password', details.password);
  data.append('ctl00$MainContent$Submit1', 'Login');

      
  const headers = {
      'Origin': details.domain,
      'Referer': details.domain + '/PXP2_Login_Student.aspx?Logout=1&regenerateSessionId=True',
      ...(details.cookies && { 'Cookie': details.cookies })
  };
  
      ////console.log(url);////console.log(data);////console.log(headers);
      await session.post(url, data, { headers })
          .then(login =>{
      ////console.log(login.status);
      ////console.log(login.statusText);
      if (login.data.includes("Good")){
          ////console.log("Logged in");
          res(); 
      
      } else if(login.data.includes("Invalid")||login.data.includes("incorrect")){
      rej(new Error("Incorrect Username or Password"))
      }else{rej(new Error("Synergy Side Error"))};}).catch(err=>{if(err.message.includes("hung up")||err.message.includes("ENOTFOUND")){rej(new Error("Network Error: Try Again Shortly"))}})

}catch(error){console.log(error);return rej(error)}}
      
      )}


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
 
            const response=await axios.post(url,data,{headers:headers})
                return(response.data);
    }



function parseClassData(data){
  data=data.reportCardScoreTypes;
  const gradeScale={};
  data[2].details.forEach(grade=>{
    console.log(grade)
      if(grade.lowScore>=0&&grade.highScore>=0){
        console.log("bullshit")
        gradeScale[grade.score]=[grade.lowScore,grade.highScore];

  }});

  if(!(Object.keys(gradeScale).length>0)){console.log("werid county");console.log(data)} //temp logging to examine the variance across counties of the grading Scale index

  return Object.keys(gradeScale).length > 0 ? gradeScale : null;
}



async function getGradeScale(details){ //reformed version of the refresh function from webScraping version
       const cookieJar = new tough.CookieJar();
        const session = await wrapper(axios.create({
              withCredentials: true,
              jar: cookieJar
          }));
          await logIn(details,session).catch(error=>{console.log(error);return "failure"})
          cookieJar.getCookies(details.domain, (err, cookies) => {
          cookies="PVUE=ENG; "+cookies[0].key+"="+cookies[0].value + "; " + cookies[2].key + "="+cookies[2].value+";";
                      ////console.log("fuck me sideways")
                      ////console.log(cookies)
          details.cookies=cookies;
            });
          const raw=await getRawClassData(details)
          return(parseClassData(raw))
            

}

function parseFormData(loginPage) {
  const dom = new JSDOM(loginPage);
  const document = dom.window.document;

  const viewStateElement = document.getElementById('__VIEWSTATE');
  const eventValidationElement = document.getElementById('__EVENTVALIDATION');

  const _VIEWSTATE = viewStateElement ? viewStateElement.value : null;
  const _EVENTVALIDATION = eventValidationElement ? eventValidationElement.value : null;
  ////console.log(_VIEWSTATE);////console.log(_EVENTVALIDATION);

  return [_VIEWSTATE, _EVENTVALIDATION];
}




app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g


