import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

// Create Express app
const app = express();
let PORT = process.env.PORT;
let CURR_ENV = "Production"
if (PORT === undefined) {
  CURR_ENV = "Development";
  PORT = 10000;
}

const DB_PATH = process.env.DB_PATH || './backend/galaxy_data/astrometrics.sqlite';

const allowedOrigins = [
  'https://gh-cartography.onrender.com', 
  'http://localhost:5173'
];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());


// Database connection
let db;
try {
  // Ensure the directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
    console.log('Connected to SQLite database with sqlite3 at', DB_PATH);
  });
} catch (error) {
  console.error('Error creating database connection:', error.message);
  process.exit(1);
}

// Ensure systems table exists, or create it if not
function ensureSystemsTable() {
  return new Promise((resolve, reject) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='systems'", (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (row) {
        resolve();
      } else {
        const createSql = `CREATE TABLE systems (
          id TEXT PRIMARY KEY,
          name TEXT,
          anchors TEXT,
          ghc_x REAL,
          ghc_y REAL,
          ghc_z REAL,
          color TEXT,
          is_anchor INTEGER,
          anchor_id TEXT,
          confidence REAL,
          galaxy TEXT DEFAULT 'calypso'
        )`;
        db.run(createSql, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Created systems table');
            resolve();
          }
        });
      }
    });
  });
}

// Initialize database with coordinate columns if they don't exist
function initializeDatabase() {
  console.log('Initializing database...');
  
  return new Promise(async (resolve, reject) => {
    try {
      await ensureSystemsTable();
    } catch (err) {
      console.error('Error ensuring systems table:', err.message);
      reject(err);
      return;
    }
    
    db.all("PRAGMA table_info(systems)", (err, columns) => {
      if (err) {
        console.error('Error getting table info:', err.message);
        reject(err);
        return;
      }
      
      console.log('Current table structure:');
      columns.forEach(column => {
        console.log(`  - ${column.name} (${column.type})`);
      });
      
      const existingColumns = columns.map(col => col.name);
      const neededColumns = ['id', 'name', 'anchors', 'ghc_x', 'ghc_y', 'ghc_z', 'color', 'is_anchor', 'anchor_id', 'confidence', 'galaxy'];
      const missingColumns = neededColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('All coordinate columns already exist');
        resolve();
        return;
      }
      
      console.log(`Missing columns: ${missingColumns.join(', ')}`);
      
      let completed = 0;
      missingColumns.forEach(columnName => {
        let colDef = 'TEXT';
        if (['ghc_x', 'ghc_y', 'ghc_z', 'confidence'].includes(columnName)) colDef = 'REAL';
        if (columnName === 'is_anchor') colDef = 'INTEGER';
        if (columnName === 'galaxy') colDef = "TEXT DEFAULT 'calypso'";

        const sql = `ALTER TABLE systems ADD COLUMN ${columnName} ${colDef}`;
        db.run(sql, (err) => {
          if (err) {
            if (err.message.includes('duplicate column name')) {
              console.log(`Column ${columnName} already exists`);
            } else {
              console.error(`Error adding column ${columnName}:`, err.message);
              reject(err);
              return;
            }
          } else {
            console.log(`Added column: ${columnName}`);
          }
          
          completed++;
          if (completed === missingColumns.length) {
            console.log('Database initialization completed');
            resolve();
          }
        });
      });
    });
  });
}

app.post('/add-system', (req, res) => {
  const galaxy = req.query.galaxy || 'calypso';
  const { id, name, new_a, new_b, new_c, new_d, new_e, color } = req.body;
  let ghc_x, ghc_y, ghc_z, is_anchor, anchor_id, confidence;
  ghc_x = null;
  ghc_y = null;
  ghc_z = null;
  is_anchor = 0;
  anchor_id = 0;
  confidence = 0;
  
  if (!name || new_a === undefined || new_b === undefined || new_c === undefined || new_d === undefined || color === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const anchorsObj = { 
    A: new_a, 
    B: new_b, 
    C: new_c, 
    D: new_d, 
    E: new_e !== undefined && new_e !== '' ? new_e : null
  };
  const anchors = JSON.stringify(anchorsObj);

  const query = `INSERT INTO systems (id, name, anchors, ghc_x, ghc_y, ghc_z, color, is_anchor, anchor_id, confidence, galaxy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(query, [id, name, anchors, ghc_x, ghc_y, ghc_z, color, is_anchor, anchor_id, confidence, galaxy], function(err) {
    if (err) {
      console.error('Database insert error:', err);
      return res.status(500).json({ error: 'Failed to write to database' });
    }
    
    res.status(201).json({ 
      message: 'System successfully added', 
      id: this.lastID 
    });
  });
});

// GET /systems - Get all systems
app.get('/systems', (req, res) => {
  const galaxy = req.query.galaxy || 'calypso';
  console.log(`Fetching systems for ${galaxy}...`);
  
  db.all('SELECT * FROM systems WHERE galaxy = ? ORDER BY id', [galaxy], (err, rows) => {
    if (err) {
      console.error('Error fetching systems:', err.message);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

// POST /update-coordinates - Update system coordinates
app.post('/update-coordinates', (req, res) => {
  try {
    const galaxy = req.query.galaxy || 'calypso';
    const { name, ghc_x, ghc_y, ghc_z } = req.body;
    
    if (!name || typeof ghc_x !== 'number' || typeof ghc_y !== 'number' || typeof ghc_z !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid input. Required: name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
      });
    }
    
    const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ? AND galaxy = ?';
    db.run(sql, [ghc_x, ghc_y, ghc_z, name, galaxy], function(err) {
      if (err) {
        console.error('Error updating coordinates:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: `System '${name}' not found in ${galaxy}` });
        return;
      }
      
      console.log(`Updated coordinates for ${name}: [${ghc_x.toFixed(2)}, ${ghc_y.toFixed(2)}, ${ghc_z.toFixed(2)}]`);
      res.json({ 
        success: true, 
        message: `Coordinates updated for ${name}`,
        changes: this.changes,
        coordinates: { ghc_x, ghc_y, ghc_z }
      });
    });
    
  } catch (error) {
    console.error('Error in /update-coordinates endpoint:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /system/:name - Get specific system by name
app.get('/system/:name', (req, res) => {
  try {
    const galaxy = req.query.galaxy || 'calypso';
    const { name } = req.params;
    
    db.get('SELECT * FROM systems WHERE name = ? AND galaxy = ?', [name, galaxy], (err, row) => {
      if (err) {
        console.error('Error fetching system:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (!row) {
        res.status(404).json({ error: `System '${name}' not found in ${galaxy}` });
        return;
      }
      
      res.json(row);
    });
    
  } catch (error) {
    console.error('Error in /system/:name endpoint:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /systems-with-coordinates - Get systems that have coordinates
app.get('/systems-with-coordinates', (req, res) => {
  const galaxy = req.query.galaxy || 'calypso';
  const query = 'SELECT * FROM systems WHERE ghc_x IS NOT NULL AND ghc_y IS NOT NULL AND ghc_z IS NOT NULL AND galaxy = ? ORDER BY id';
  
  db.all(query, [galaxy], (err, rows) => {
    if (err) {
      console.error('Error fetching systems with coordinates:', err.message);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    res.json({
      count: rows.length,
      systems: rows
    });
  });
});

// GET /coordinates-status - Get status of coordinate updates
app.get('/coordinates-status', (req, res) => {
  const galaxy = req.query.galaxy || 'calypso';
  const sql = `
    SELECT 
      COUNT(*) as total_systems,
      SUM(CASE WHEN ghc_x IS NOT NULL AND ghc_y IS NOT NULL AND ghc_z IS NOT NULL THEN 1 ELSE 0 END) as systems_with_coordinates,
      SUM(CASE WHEN ghc_x IS NULL OR ghc_y IS NULL OR ghc_z IS NULL THEN 1 ELSE 0 END) as systems_without_coordinates
    FROM systems
    WHERE galaxy = ?
  `;
  
  db.get(sql, [galaxy], (err, row) => {
    if (err) {
      console.error('Error getting coordinates status:', err.message);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    const percentage = row.total_systems > 0 ? 
      ((row.systems_with_coordinates / row.total_systems) * 100).toFixed(1) : 0;
    
    res.json({
      total_systems: row.total_systems,
      systems_with_coordinates: row.systems_with_coordinates,
      systems_without_coordinates: row.systems_without_coordinates,
      completion_percentage: percentage
    });
  });
});

// POST /batch-update-coordinates - Update multiple systems at once
app.post('/batch-update-coordinates', (req, res) => {
  try {
    const galaxy = req.query.galaxy || 'calypso';
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    for (const update of updates) {
      if (!update.name || typeof update.ghc_x !== 'number' || 
          typeof update.ghc_y !== 'number' || typeof update.ghc_z !== 'number') {
        return res.status(400).json({ 
          error: 'Each update must have: name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
        });
      }
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare('UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ? AND galaxy = ?');
      let updatedCount = 0;
      let completed = 0;
      
      updates.forEach((update, index) => {
        stmt.run([update.ghc_x, update.ghc_y, update.ghc_z, update.name, galaxy], function(err) {
          if (err) {
            console.error(`Error updating ${update.name}:`, err.message);
          } else if (this.changes > 0) {
            updatedCount++;
            console.log(`Updated ${update.name}: [${update.ghc_x.toFixed(2)}, ${update.ghc_y.toFixed(2)}, ${update.ghc_z.toFixed(2)}]`);
          } else {
            console.warn(`System not found in ${galaxy}: ${update.name}`);
          }
          
          completed++;
          if (completed === updates.length) {
            stmt.finalize();
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err.message);
                res.status(500).json({ error: 'Database error' });
                return;
              }
              
              res.json({ 
                success: true, 
                message: `Updated ${updatedCount} out of ${updates.length} systems`,
                updated_count: updatedCount,
                total_requested: updates.length
              });
            });
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Error in /batch-update-coordinates endpoint:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /upload-systems - Upload or update multiple systems
app.post('/upload', (req, res) => {
  try {
    const galaxy = req.query.galaxy || 'calypso';
    const { systems } = req.body;
    
    if (!Array.isArray(systems)) {
      return res.status(400).json({ error: 'systems must be an array' });
    }
    if (systems.length === 0) {
      return res.status(400).json({ error: 'systems array is empty' });
    }
    
    for (const sys of systems) {
      if (!sys.id || !sys.name) {
        return res.status(400).json({ error: 'Each system must have at least id and name' });
      }
      sys.galaxy = sys.galaxy || galaxy;
    }
    
    const fields = ['id','name','anchors','ghc_x','ghc_y','ghc_z','color','is_anchor','anchor_id', 'confidence', 'galaxy'];
    const placeholders = fields.map(() => '?').join(',');
    const sql = `INSERT OR REPLACE INTO systems (${fields.join(',')}) VALUES (${placeholders})`;
    
    let inserted = 0;
    db.serialize(() => {
      const stmt = db.prepare(sql);
      for (const sys of systems) {
        const values = fields.map(f => sys[f] !== undefined ? sys[f] : null);
        stmt.run(values, function(err) {
          if (!err) inserted++;
        });
      }
      stmt.finalize((err) => {
        if (err) {
          res.status(500).json({ error: 'Database error', details: err.message });
        } else {
          res.json({ success: true, inserted, total: systems.length });
        }
      });
    });
  } catch (error) {
    console.error('Error in /upload-systems:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM systems', (err, row) => {
    if (err) {
      res.status(500).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        database: 'error',
        error: err.message
      });
      return;
    }
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      total_systems: row.count
    });
  });
});

// Start server
async function startServer() {
  try {
    console.log('Starting server initialization...');
    
    await initializeDatabase();
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on ${CURR_ENV}`);
      console.log('Available endpoints:');
      console.log('  GET  /systems                    - Get all systems');
      console.log('  GET  /system/:name               - Get specific system');
      console.log('  POST /update-coordinates         - Update single system coordinates');
      console.log('  POST /batch-update-coordinates   - Update multiple systems');
      console.log('  GET  /systems-with-coordinates   - Get systems with coordinates');
      console.log('  GET  /coordinates-status         - Get coordinate update status');
      console.log('  GET  /health                     - Health check');
      console.log('  POST /add-system                 - Submit a new system to the database')
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (db) {
    db.close();
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (db) {
    db.close();
  }
  process.exit(1);
});

startServer();
