// src/server.js
const express = require('express');

const app = express();
const PORT = 3000;

// A simple route - when someone visits http://localhost:3000/
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Sisukas backend!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});