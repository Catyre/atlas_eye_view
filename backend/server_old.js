const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
const PORT = 3000;

const EUCLID = './galaxy_data/euclid_astrometrics.sqlite';
const CALYPSO = './galaxy_data/calypso_astrometrics.sqlite';

const db = new Database(EUCLID, Database.OPEN_READWRITE);

app.use(cors());
app.use(express.json());

app.get('/systems', (req, res) => {
  const systems = db.prepare('SELECT * FROM systems').all();
  res.json(systems);
});

app.get('/systems/:id', (req, res) => {
  const system = db.prepare('SELECT * FROM systems WHERE id = ?').get(req.params.id);
  if (!system) return res.status(404).json({ error: "System not found" });
  res.json({ ...system});
});

// POST /update-coordinates - Update system coordinates
app.post('/update-coordinates', async (req, res) => {
  try {
    const { name, ghc_x, ghc_y, ghc_z } = req.body;
    
    // Validate input
    if (!name || typeof ghc_x !== 'number' || typeof ghc_y !== 'number' || typeof ghc_z !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid input. Required: name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
      });
    }
    
    // Update coordinates in database
    const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ?';
    const params = [ghc_x, ghc_y, ghc_z, name];
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error updating coordinates:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: `System '${name}' not found` });
        return;
      }
      
      console.log(`Updated coordinates for ${name}: [${ghc_x}, ${ghc_y}, ${ghc_z}]`);
      res.json({ 
        success: true, 
        message: `Coordinates updated for ${name}`,
        changes: this.changes,
        coordinates: { ghc_x, ghc_y, ghc_z }
      });
    });
  
  } catch (error) {
    console.error('Error in /update-coordinates endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// POST /batch-update-coordinates - Update multiple systems at once
app.post('/batch-update-coordinates', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    // Validate each update
    for (const update of updates) {
      if (!update.name || typeof update.ghc_x !== 'number' || 
          typeof update.ghc_y !== 'number' || typeof update.ghc_z !== 'number') {
        return res.status(400).json({ 
          error: 'Each update must have: name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
        });
      }
    }
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let completed = 0;
      let errors = [];
      
      updates.forEach(update => {
        const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ?';
        const params = [update.ghc_x, update.ghc_y, update.ghc_z, update.name];
        
        db.run(sql, params, function(err) {
          if (err) {
            errors.push({ name: update.name, error: err.message });
          }
          
          completed++;
          
          if (completed === updates.length) {
            if (errors.length > 0) {
              db.run('ROLLBACK');
              res.status(500).json({ 
                error: 'Some updates failed', 
                errors: errors 
              });
            } else {
              db.run('COMMIT');
              res.json({ 
                success: true, 
                message: `Updated ${updates.length} systems`,
                updated_count: updates.length
              });
            }
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /batch-update-coordinates endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept new data
app.post('/upload', (req, res) => {
  const { systems = []} = req.body;

  const insertSystem = db.prepare(`
    INSERT OR REPLACE INTO systems (id, name, A, B, C, D, color, is_anchor, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const systemTxn = db.transaction((systems) => {
    console.log(systems)
    for (const s of systems) {
      insertSystem.run(
        s.id,
        s.name || null,
        s.A ?? null,
        s.B ?? null,
        s.C ?? null,
        s.D ?? null,
        s.color ?? null,
        s.is_anchor ? 1 : 0,
        s.confidence ?? 0
      );
      console.log("Inserting ", s);
    }
  });

  systemTxn(systems);

  res.json({ status: 'Data received and inserted' });
  console.log("POST received and processed")
});

// Start server
async function startServer() {
  try {
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Available endpoints:');
      console.log('  GET  /systems                    - Get all systems');
      console.log('  GET  /system/:name               - Get specific system');
      console.log('  POST /update-coordinates         - Update single system coordinates');
      console.log('  POST /batch-update-coordinates   - Update multiple systems');
      console.log('  GET  /systems-with-coordinates   - Get systems with coordinates');
      console.log('  GET  /coordinates-status         - Get coordinate update status');
      console.log('  GET  /health                     - Health check');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

// Start the server
startServer(); 
