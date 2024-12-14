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




app.get('/', async (req, res) => {
  res.send('Hello World');

});


