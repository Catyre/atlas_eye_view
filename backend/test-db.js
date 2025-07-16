const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing database connection with better-sqlite3...');

// Check if database file exists
const dbPath = './euclid.sqlite';
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found:', dbPath);
  console.log('💡 Please ensure euclid.sqlite exists in the backend directory');
  process.exit(1);
}

console.log('✅ Database file found:', dbPath);

try {
  // Connect to database
  const db = new Database(dbPath, { verbose: console.log });
  console.log('✅ Connected to SQLite database with better-sqlite3');
  
  // Test basic query - check if systems table exists
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='systems'");
  const tableResult = tableCheck.get();
  
  if (!tableResult) {
    console.error('❌ Systems table not found in database');
    console.log('💡 Please ensure your database has a "systems" table');
    db.close();
    process.exit(1);
  }
  
  console.log('✅ Systems table found');
  
  // Test table structure
  const tableInfo = db.prepare("PRAGMA table_info(systems)");
  const columns = tableInfo.all();
  
  console.log('📋 Table structure:');
  columns.forEach(column => {
    console.log(`  - ${column.name} (${column.type})`);
  });
  
  // Check for coordinate columns
  const hasCoordinates = columns.some(column => 
    column.name === 'ghc_x' || column.name === 'ghc_y' || column.name === 'ghc_z'
  );
  
  if (hasCoordinates) {
    console.log('✅ Coordinate columns already exist');
  } else {
    console.log('⚠️  Coordinate columns not found (will be added automatically)');
  }
  
  // Test sample query
  const countQuery = db.prepare("SELECT COUNT(*) as count FROM systems");
  const countResult = countQuery.get();
  console.log(`📊 Total systems in database: ${countResult.count}`);
  
  // Test a sample system query
  const sampleQuery = db.prepare("SELECT name, A, B, C, D FROM systems LIMIT 3");
  const sampleSystems = sampleQuery.all();
  
  console.log('📋 Sample systems:');
  sampleSystems.forEach((system, index) => {
    console.log(`  ${index + 1}. ${system.name} - A:${system.A}, B:${system.B}, C:${system.C}, D:${system.D}`);
  });
  
  // Test database performance
  console.log('⚡ Testing database performance...');
  const startTime = Date.now();
  const perfQuery = db.prepare("SELECT COUNT(*) FROM systems WHERE name LIKE ?");
  const perfResult = perfQuery.get('%a%');
  const endTime = Date.now();
  
  console.log(`⏱️  Query performance: ${endTime - startTime}ms`);
  
  // Close database
  db.close();
  console.log('✅ Database test completed successfully');
  console.log('🚀 You can now start the server with: npm start');
  
} catch (error) {
  console.error('❌ Database test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 