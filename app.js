const express = require('express');
const axios = require('axios');
const cors = require('cors');
const CryptoJS = require('crypto-js');
const xmlEscape = require('xml-escape');
const XMLParser = require('fast-xml-parser');
const { Pool } = require('pg');
const e = require('express');


const pool = new Pool({
  user: 'postgres',
  host: 'autorack.proxy.rlwy.net',
  database: 'railway',
  password: 'YagjEpbJqKUOmAvaUYmcwYpqKBWJGkLa',
  port: 52329,
});


const app=express(express.json());

app.use(cors({ origin: '*' }));

// Or use a simple middleware function
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});




app.get('/getEvents', async (req, res) => {
try{
  console.log("fuck fuck fuck")
  const events = await getEvents();
  res.json({status:true,events:events});

}
catch{res.json({status:false})}


});

async function getEvents(){
  const query='SELECT * FROM gamblingEvents';
  const result = await pool.querey(query);
  return result.rows;
}


// Replace client.connect() and client.end() with pool.query().


