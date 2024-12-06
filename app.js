const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const xmlEscape = require('xml-escape');
const XMLParser = require('fast-xml-parser');
const { Pool } = require('pg');


const app = express();
app.use(express.json()); // Parse incoming JSON requests
app.options('*', cors()); //{origin:"https://grademelon.org"}
app.use(cors());
app.use(express.static('public'));

const encryptionKey = process.env.encryptionkey;
var apikey=generateKey();

const pool = new Pool({
  user: 'postgres',
  host: 'autorack.proxy.rlwy.net',
  database: 'railway',
  password: 'zuJWJBhePTqPhaZdxTEyBlpQJPiswvgH',
  port: 52329,
});

// Replace client.connect() and client.end() with pool.query().






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



function listFromRow(row){
  delete row.total;delete row.id;delete row.date;
  return Object.entries(row)
  .map(([region, users]) => users.length!=0 ? `<p>${region}: ${users.length}</p>` : null).filter(region=>region!=null).join("<br>");

}

function formatDate(date){
  return date.substring(0,2)+"/"+date.substring(2,4)+"/"+date.substring(4)
}


async function listFromDate(date){
  try{
  const dateRow=await hasDate(date);
  if(!dateRow){return("no such data")}else{
    console.log(Object.keys(dateRow))
    let sendstring=`<h1>User Count ${formatDate(date)}</h1>`;
    let total=dateRow.total;
    sendstring+=`<br/><h2>Total: ${total}</h2>`
    sendstring+=`<br></br><a href="/userCount/${getDateMMDDYY(date,-1)}">Prev</a><br></br>`;
    sendstring+=`<a href="/userCount/${getDateMMDDYY(date,1)}">Next</a><br></br>`;
    sendstring +=listFromRow(dateRow);
    return(sendstring);
  }
  }
  catch(error){return(error.message)}
}


app.get("/",(req,res)=>{res.send(`<h1>GradeMelon API</h1><a href="/userCount/">User Count</a><br><a href="/gradeScales/">Grade Scales</a><br><a href="/userCount/all">Total Unique Users</a><br><a href="/userCount/percentLogins">Daily Login Percentages</a>`)})


app.get("/userCount/",async(req,res)=>{
  try{

    res.send(backButton+await listFromDate(getDateMMDDYY()));
  }
  catch(error){res.send(error.message)}
})

app.get("/userCount/:date",async(req,res)=>{
  const date=req.params.date;
  if(date=="all"){
    try{
      const master=await getTotalUniqueUsers();
      const dates=await pool.query('SELECT Date FROM analytics ORDER BY CAST(Date as INTEGER);');
      const dateList=dates.rows.map(row=>row.date);
      sendstring=`<h1>Total Unique User Count</h1><h2>from ${formatDate(dateList[0])} to ${formatDate(dateList[dateList.length-1])}</h2><br></br>`;
      sendstring+=`<br/><h2>Total: ${master.total}</h2>`
      sendstring+=listFromRow(master);
      res.send(backButton+sendstring);
    }
    catch(error){res.send(backButton+error.message)}

  }
  else if(date=="percentLogins"){
    try{
      const percentages=await getDailyLoginPercent();
      res.send(backButton+percentages.map((percent,index)=>(`<p>Day ${index+1}: ${percent}% of users logged in</p>`)).join("<br>"));
      }catch(error){res.send(backButton+error.message)}
    

  }

  else{
  try{
    res.send(backButton+await listFromDate(date))
  }
  catch(error){console.log(error);res.send(backButton+"No data for this date")}
}
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

  if(parsedXml.methodName=="Gradebook"&&!gradingScales.has(details.url.replace("/Service/PXPCommunication.asmx",""))&&!response.data.includes("ERROR_MESSAGE")){
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


app.post("/logLogin",async(req,res)=>{
  try{
  const details=req.body;
  details.username=CryptoJS.SHA1(details.username).toString();
  const date=getDateMMDDYY();
  if(await hasSchoolName(details.schoolName)){}else{
    await addSchoolName(details.schoolName);
  
  }
  var dateRow=await hasDate(date);
  if(dateRow){
  }else{
    await addDate(date);
    dateRow=await hasDate(date);
    ``
    
  }
  if(dateRow[details.schoolName].includes(details.username)){return}else{addUsername(date,details)
    await incrementColumnValue('analytics', 'total', date);}
  
  res.json({status:true})
  }catch(error){console.log(sanitizeError(error));res.json({status:false})}
})

function sanitizeIdentifier(identifier) {
  // Allow only alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

async function hasDate(date) {
  try {
    // Ensure the client is connected


    // Prepare the query
    const query = `SELECT * FROM analytics WHERE date = $1`;

    // Execute the query
    const result = await pool.query(query, [date]);

    // Return the relevant row if it exists, otherwise false
    return result.rows[0] || false;
  } catch (error) {
    console.error('Error querying the database:', error);
    throw error; // Rethrow the error to notify the caller
  } finally {
    // Close the client connection after the operation
   // await client.end();
  }
}


async function hasSchoolName(schoolName) {
  try {
    // Connect to the database
    //await client.connect();


    
    // Use parameterized queries to prevent SQL injection
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'analytics'
          AND column_name = $1
      );
    `;
    
    const result = await pool.query(query, [schoolName]);

    // Return the boolean result
    
    return result.rows[0].exists;
  } catch (err) {
    console.error('Error checking school name:', err.stack);
    return false; // Default to false on error
  } finally {
 //   await client.end(); // Ensure the connection is closed
  }
}



async function addSchoolName(schoolName) {
  try {
    schoolName=sanitizeIdentifier(schoolName);
    // Connect to the database
   // await client.connect();


    
    // Use dynamic SQL to add a new column of type TEXT[]
    const query = `
      ALTER TABLE analytics
      ADD COLUMN "${schoolName}" TEXT[] DEFAULT '{}';
    `;

    await pool.query(query);
    console.log(`Column '${schoolName}' added successfully.`);
  } catch (error) {
    console.error('Error adding school name column:', error);
    throw error; // Re-throw the error to notify the caller
  } finally {
   // await client.end(); // Ensure the connection is closed
  }
}



async function addDate(date){
  try{
  // Connect to the database
 /* client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err.stack));
  */

  query=`INSERT INTO analytics (date) VALUES ('${date}');`
  await pool.query(query);}
  finally{
    //await client.end();
  }}



async function addUsername(date,details){
  try{
    details.schoolName=sanitizeIdentifier(details.schoolName);
    details.username=sanitizeIdentifier(details.username);
  // Connect to the database
  /*
  client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err.stack));
  */

  query=`UPDATE analytics
  SET "${details.schoolName}"= CASE
      WHEN NOT ('${details.username}'= ANY("${details.schoolName}")) THEN array_append("${details.schoolName}", '${details.username}')
      ELSE "${details.schoolName}"
  END
  WHERE date = '${date}';`
  
  await pool.query(query);}
  finally{
   // await client.end();}
}}













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


async function incrementColumnValue(tableName, columnName, date, incrementBy = 1) {
  try {
   // await client.connect();

    console.log('Connected to PostgreSQL');
    
    // Parameterized query to prevent SQL injection
    const query = `
      UPDATE ${tableName}
      SET ${columnName} = ${columnName} + ${incrementBy}
      WHERE date = '${date}'
      RETURNING ${columnName};
    `;

    const result = await pool.query(query);

    if (result.rows.length > 0) {
      console.log(`Updated value: ${result.rows[0][columnName]}`);
      return result.rows[0][columnName];
    } else {
      throw new Error('Row not found or no updates made');
    }
  } catch (err) {
    console.error('Error incrementing column value:', err.stack);
    return null;
  } finally {
 //   await client.end();
  }
}



async function getTotalUniqueUsers(limit=0){
  const result = await pool.query('SELECT * FROM analytics ORDER BY CAST(Date as INTEGER);');
  const master={};
  result.rows.forEach(row=>{delete row.date;delete row.total;});
  for(let i=0;i<Object.keys(result.rows[0]).length;i++){
      const key=Object.keys(result.rows[0])[i];
      master[key]=[];
  
      for(let i=0;i<(limit ? limit : result.rows.length);i++){
          master[key].push(...result.rows[i][key]);
      }
      
  }
  
  for(let key in master){
      const unique=new Set(master[key]);
      master[key]=Array.from(unique);
      
  }
  master.total=Object.values(master).reduce((acc,curr)=>acc+curr.length,0);
  return master;
  }
  
  
  async function getDailyLoginPercent(includeCurrentDay=false){
      const result=await pool.query('SELECT * FROM analytics ORDER BY CAST(Date as INTEGER);');
      const dailyTotals=result.rows.map(row=>row.total)
      const fullTotals=[];
      for(let index=0;index<dailyTotals.length;index++){
          const total=await getTotalUniqueUsers(index+1);
          fullTotals.push(total.total);
  
      }
      const dailyPercentages=dailyTotals.map((total,index)=>((total/fullTotals[index])*100).toFixed(2));
      console.log(dailyPercentages);
      if(!includeCurrentDay){
          dailyPercentages.pop();
      }
      return dailyPercentages;
  
  }




app.listen(3000, () => {
    ////console.log('Server is running on port 3000');
});
//g


