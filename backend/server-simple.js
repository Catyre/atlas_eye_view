const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new sqlite3.Database('./euclid.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Simple systems endpoint
app.get('/systems', (req, res) => {
  db.all('SELECT * FROM systems ORDER BY id LIMIT 10', (err, rows) => {
    if (err) {
      console.error('Error fetching systems:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

// Simple coordinate update endpoint
app.post('/update-coordinates', (req, res) => {
  const { name, ghc_x, ghc_y, ghc_z } = req.body;
  
  if (!name || typeof ghc_x !== 'number' || typeof ghc_y !== 'number' || typeof ghc_z !== 'number') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ?';
  const params = [ghc_x, ghc_y, ghc_z, name];
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error('Error updating coordinates:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    console.log(`Updated coordinates for ${name}: [${ghc_x}, ${ghc_y}, ${ghc_z}]`);
    res.json({ success: true, changes: this.changes });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET  /health                     - Health check');
  console.log('  GET  /systems                    - Get first 10 systems');
  console.log('  POST /update-coordinates         - Update coordinates');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close();
  process.exit(0);
}); 