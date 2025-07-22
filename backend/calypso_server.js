const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// Create Express app
const app = express();
const PORT = 4000;

const CALYPSO = './galaxy_data/calypso_astrometrics.sqlite';

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
let db;
try {
  db = new sqlite3.Database(CALYPSO, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
    console.log('Connected to SQLite database with sqlite3');
  });
} catch (error) {
  console.error('Error creating database connection:', error.message);
  process.exit(1);
}

// Initialize database with coordinate columns if they don't exist
function initializeDatabase() {
  console.log('Initializing database...');
  
  return new Promise((resolve, reject) => {
    // Check if coordinate columns exist
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
      
      // Check for coordinate columns
      const existingColumns = columns.map(col => col.name);
      const neededColumns = ['ghc_x', 'ghc_y', 'ghc_z'];
      const missingColumns = neededColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length === 0) {
        console.log('All coordinate columns already exist');
        resolve();
        return;
      }
      
      console.log(`Missing columns: ${missingColumns.join(', ')}`);
      
      // Add missing columns
      let completed = 0;
      missingColumns.forEach(columnName => {
        const sql = `ALTER TABLE systems ADD COLUMN ${columnName} REAL`;
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

// GET /systems - Get all systems
app.get('/systems', (req, res) => {
  console.log('Fetching systems...');
  db.all('SELECT * FROM systems ORDER BY id', (err, rows) => {
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
    const { name, ghc_x, ghc_y, ghc_z } = req.body;
    
    // Validate input
    if (!name || typeof ghc_x !== 'number' || typeof ghc_y !== 'number' || typeof ghc_z !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid input. Required: name (string), ghc_x (number), ghc_y (number), ghc_z (number)' 
      });
    }
    
    // Update coordinates in database
    const sql = 'UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ?';
    db.run(sql, [ghc_x, ghc_y, ghc_z, name], function(err) {
      if (err) {
        console.error('Error updating coordinates:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: `System '${name}' not found` });
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
    const { name } = req.params;
    
    db.get('SELECT * FROM systems WHERE name = ?', [name], (err, row) => {
      if (err) {
        console.error('Error fetching system:', err.message);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      
      if (!row) {
        res.status(404).json({ error: `System '${name}' not found` });
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
  db.all('SELECT * FROM systems WHERE ghc_x IS NOT NULL AND ghc_y IS NOT NULL AND ghc_z IS NOT NULL ORDER BY id', (err, rows) => {
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
  const sql = `
    SELECT 
      COUNT(*) as total_systems,
      SUM(CASE WHEN ghc_x IS NOT NULL AND ghc_y IS NOT NULL AND ghc_z IS NOT NULL THEN 1 ELSE 0 END) as systems_with_coordinates,
      SUM(CASE WHEN ghc_x IS NULL OR ghc_y IS NULL OR ghc_z IS NULL THEN 1 ELSE 0 END) as systems_without_coordinates
    FROM systems
  `;
  
  db.get(sql, (err, row) => {
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
      
      const stmt = db.prepare('UPDATE systems SET ghc_x = ?, ghc_y = ?, ghc_z = ? WHERE name = ?');
      let updatedCount = 0;
      let completed = 0;
      
      updates.forEach((update, index) => {
        stmt.run([update.ghc_x, update.ghc_y, update.ghc_z, update.name], function(err) {
          if (err) {
            console.error(`Error updating ${update.name}:`, err.message);
          } else if (this.changes > 0) {
            updatedCount++;
            console.log(`Updated ${update.name}: [${update.ghc_x.toFixed(2)}, ${update.ghc_y.toFixed(2)}, ${update.ghc_z.toFixed(2)}]`);
          } else {
            console.warn(`System not found: ${update.name}`);
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
    
    // Initialize database
    await initializeDatabase();
    
    // Start server
    const server = app.listen(PORT, () => {
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
    
    // Add server error handling
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (db) {
    db.close();
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (db) {
    db.close();
  }
  process.exit(1);
});

// Start the server
startServer(); 
