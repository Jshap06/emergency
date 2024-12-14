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


const app=express();


app.use(cors());

app.get('/getEvents', async (req, res) => {
try{
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


