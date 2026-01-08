// src/server.js
const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Sisukas backend!' });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.post('/test', (req, res) => {
  console.log('Received data:', req.body);
  res.json({ 
    message: 'Got your data!',
    data: req.body 
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});