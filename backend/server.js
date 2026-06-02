import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lock the database path to the exact directory where server.js lives
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'galaxy_data', 'astrometrics.sqlite');

const app = express();
let PORT = process.env.PORT;
let CURR_ENV = "Production"
if (PORT === undefined) {
  CURR_ENV = "Development";
  PORT = 10000;
}

const allowedOrigins = [
  'https://gh-cartography.onrender.com', 
  'http://localhost:5173'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

/* --- Helpers --- */

// Timestamp logging helper
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Converts HTML characters to safe entities to prevent XSS attacks
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Strictly converts values to floats, rejecting strings and NaNs
const parseValidFloat = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
};

/* ---------------------------------- */

let db;
try {
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
      
      const existingColumns = columns.map(col => col.name);
      const neededColumns = ['id', 'name', 'anchors', 'ghc_x', 'ghc_y', 'ghc_z', 'color', 'is_anchor', 'anchor_id', 'confidence', 'galaxy'];
      const missingColumns = neededColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('All coordinate columns already exist');
        resolve();
        return;
      }
      
      let completed = 0;
      missingColumns.forEach(columnName => {
        let colDef = 'TEXT';
        if (['ghc_x', 'ghc_y', 'ghc_z', 'confidence'].includes(columnName)) colDef = 'REAL';
        if (columnName === 'is_anchor') colDef = 'INTEGER';
        if (columnName === 'galaxy') colDef = "TEXT DEFAULT 'calypso'";

        const sql = `ALTER TABLE systems ADD COLUMN ${columnName} ${colDef}`;
        db.run(sql, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error(`Error adding column ${columnName}:`, err.message);
            reject(err);
            return;
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
  // Clean all inputs
  const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
  const id = sanitizeString(req.body.id);
  const name = sanitizeString(req.body.name);
  const color = sanitizeString(req.body.color);
  
  const new_a = parseValidFloat(req.body.new_a);
  const new_b = parseValidFloat(req.body.new_b);
  const new_c = parseValidFloat(req.body.new_c);
  const new_d = parseValidFloat(req.body.new_d);
  const new_e = parseValidFloat(req.body.new_e);

  console.log("Raw payload:", req.body);

  if (!name || new_a === null || new_b === null || new_c === null || new_d === null || !color) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  const anchorsObj = { 
    A: new_a, 
    B: new_b, 
    C: new_c, 
    D: new_d, 
    E: new_e 
  };
  const anchors = JSON.stringify(anchorsObj);

  const query = `INSERT INTO systems (id, name, anchors, ghc_x, ghc_y, ghc_z, color, is_anchor, anchor_id, confidence, galaxy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(query, [id, name, anchors, null, null, null, color, 0, 0, 0, galaxy], function(err) {
    if (err) {
      console.error('Database insert error:', err);
      return res.status(500).json({ error: 'Failed to write to database' });
    }
    
    logWithTimestamp(`NEW SYSTEM ADDED: '${name}' (ID: ${id}) in galaxy '${galaxy}'.`);
    
    res.status(201).json({ 
      message: 'System successfully added', 
      id: this.lastID 
    });
  });
});

app.get('/systems', (req, res) => {
  const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
  
  logWithTimestamp(`DATA ACCESSED: Full system list requested for galaxy '${galaxy}'.`);
  
  db.all('SELECT * FROM systems WHERE galaxy = ? ORDER BY id', [galaxy], (err, rows) => {
    if (err) {
      console.error('Error fetching systems:', err.message);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});


app.post('/update-coordinates', (req, res) => {
  try {
    // Rely on the database driver for safety, not HTML sanitization
    const galaxy = (req.query.galaxy || 'calypso').toLowerCase();
    const name = req.body.name; 
    
    const ghc_x = parseValidFloat(req.body.ghc_x);
    const ghc_y = parseValidFloat(req.body.ghc_y);
    const ghc_z = parseValidFloat(req.body.ghc_z);
    
    // Allow null coordinates so the frontend can un-map a broken system,
    // and safely check the name without rejecting the number 0
    if (name === undefined || name === null || name.toString().trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid input. System name is required.' 
      });
    }
    
    const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ? AND galaxy = ?';
    
    db.run(sql, [ghc_x, ghc_y, ghc_z, name.toString(), galaxy], function(err) {
      if (err) {
        console.error('Error updating coordinates:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: `System '${name}' not found in ${galaxy}` });
        return;
      }
      
      logWithTimestamp(`COORDINATES UPDATED: '${name}' in galaxy '${galaxy}'.`);
      
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


app.get('/system/:name', (req, res) => {
  try {
    const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
    const name = sanitizeString(req.params.name);
    
    logWithTimestamp(`DATA ACCESSED: Specific system details requested for '${name}' in galaxy '${galaxy}'.`);
    
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

app.get('/systems-with-coordinates', (req, res) => {
  const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
  
  logWithTimestamp(`DATA ACCESSED: Systems with resolved coordinates requested for galaxy '${galaxy}'.`);
  
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

app.get('/coordinates-status', (req, res) => {
  const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
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

app.post('/batch-update-coordinates', (req, res) => {
  try {
    const galaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }
    
    const cleanUpdates = [];
    for (const update of updates) {
      const cleanName = sanitizeString(update.name);
      const cleanX = parseValidFloat(update.ghc_x);
      const cleanY = parseValidFloat(update.ghc_y);
      const cleanZ = parseValidFloat(update.ghc_z);

      if (!cleanName || cleanX === null || cleanY === null || cleanZ === null) {
        return res.status(400).json({ 
          error: 'Each update must have: valid name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
        });
      }
      cleanUpdates.push({ name: cleanName, ghc_x: cleanX, ghc_y: cleanY, ghc_z: cleanZ });
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare('UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ? AND galaxy = ?');
      let updatedCount = 0;
      let completed = 0;
      
      cleanUpdates.forEach((update) => {
        stmt.run([update.ghc_x, update.ghc_y, update.ghc_z, update.name, galaxy], function(err) {
          if (err) {
            console.error(`Error updating ${update.name}:`, err.message);
          } else if (this.changes > 0) {
            updatedCount++;
          }
          
          completed++;
          if (completed === cleanUpdates.length) {
            stmt.finalize();
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err.message);
                res.status(500).json({ error: 'Database error' });
                return;
              }
              
              logWithTimestamp(`BATCH UPDATE: ${updatedCount} out of ${cleanUpdates.length} systems updated in galaxy '${galaxy}'.`);
              
              res.json({ 
                success: true, 
                message: `Updated ${updatedCount} out of ${cleanUpdates.length} systems`,
                updated_count: updatedCount,
                total_requested: cleanUpdates.length
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

app.post('/upload', (req, res) => {
  try {
    const defaultGalaxy = sanitizeString(req.query.galaxy || 'calypso').toLowerCase();
    const { systems } = req.body;
    
    if (!Array.isArray(systems)) {
      return res.status(400).json({ error: 'systems must be an array' });
    }
    if (systems.length === 0) {
      return res.status(400).json({ error: 'systems array is empty' });
    }
    
    const cleanSystems = [];
    for (const sys of systems) {
      const cleanId = sanitizeString(sys.id);
      const cleanName = sanitizeString(sys.name);
      
      if (!cleanId || !cleanName) {
        return res.status(400).json({ error: 'Each system must have valid id and name' });
      }

      let parsedAnchors = null;
      if (typeof sys.anchors === 'object' && sys.anchors !== null) {
        parsedAnchors = JSON.stringify(sys.anchors);
      } else if (typeof sys.anchors === 'string') {
        parsedAnchors = sys.anchors; // Assuming pre-stringified JSON
      }

      cleanSystems.push({
        id: cleanId,
        name: cleanName,
        anchors: parsedAnchors,
        ghc_x: parseValidFloat(sys.ghc_x),
        ghc_y: parseValidFloat(sys.ghc_y),
        ghc_z: parseValidFloat(sys.ghc_z),
        color: sys.color ? sanitizeString(sys.color) : null,
        is_anchor: sys.is_anchor ? 1 : 0,
        anchor_id: sys.anchor_id ? sanitizeString(sys.anchor_id) : null,
        confidence: parseValidFloat(sys.confidence),
        galaxy: sanitizeString(sys.galaxy || defaultGalaxy).toLowerCase()
      });
    }
    
    const fields = ['id','name','anchors','ghc_x','ghc_y','ghc_z','color','is_anchor','anchor_id', 'confidence', 'galaxy'];
    const placeholders = fields.map(() => '?').join(',');
    const sql = `INSERT OR REPLACE INTO systems (${fields.join(',')}) VALUES (${placeholders})`;
    
    let inserted = 0;
    db.serialize(() => {
      const stmt = db.prepare(sql);
      for (const sys of cleanSystems) {
        const values = fields.map(f => sys[f] !== undefined ? sys[f] : null);
        stmt.run(values, function(err) {
          if (!err) inserted++;
        });
      }
      stmt.finalize((err) => {
        if (err) {
          res.status(500).json({ error: 'Database error', details: err.message });
        } else {
          logWithTimestamp(`BATCH UPLOAD: ${inserted} systems inserted/replaced in galaxy '${defaultGalaxy}'.`);
          res.json({ success: true, inserted, total: cleanSystems.length });
        }
      });
    });
  } catch (error) {
    console.error('Error in /upload-systems:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

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

async function startServer() {
  try {
    console.log('Starting server initialization...');
    await initializeDatabase();
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on ${CURR_ENV}`);
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
