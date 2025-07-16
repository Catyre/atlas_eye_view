import * as validation from '../validation.js';
import * as tri from '../trilateration.js';

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Database configuration - adjust these for your backend
const sqlite3 = require('sqlite3').verbose(); // For SQLite

// Database connection - choose your database type
const db = new sqlite3.Database('./euclid.sqlite');

// Config
const VALIDATION_CSV = './validation_data.json';

// Load validation data
function loadValidationData() {
  try {
    const text = fs.readFileSync(VALIDATION_CSV, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    console.warn('Could not load validation data:', error.message);
    return [];
  }
}

// Get all systems from database
async function getAllSystems() {
  try {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM systems ORDER BY id', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
  } catch (error) {
    console.error('Error fetching systems from database:', error);
    throw error;
  }
}

// Update confidence for a single system
async function updateSystemConfidence(systemId, confidence) {
  try {
    return new Promise((resolve, reject) => {
      db.run('UPDATE systems SET confidence = ? WHERE id = ?', [confidence, systemId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    console.error(`Error updating confidence for system ID ${systemId}:`, error);
    throw error;
  }
}

// Update confidence values for all systems in database
async function updateAllConfidenceValues() {
  console.log('Starting confidence update for all systems in database...');
  
  try {
    // Load validation data
    const validationData = loadValidationData();
    console.log(`Loaded ${validationData.length} validation entries`);
    
    // Get all systems from database
    const systems = await getAllSystems();
    console.log(`Loaded ${systems.length} systems from database`);
    
    // Create system positions map (simplified - using distances as coordinates)
    const systemPositions = {};
    systems.forEach(system => {
      systemPositions[system.name] = [parseFloat(system.A), parseFloat(system.B), parseFloat(system.C)];
    });
    
    // Calculate new confidence values for all systems
    const updatedSystems = systems.map(system => {
      const baseSystem = {
        id: system.id,
        name: system.name,
        A: parseFloat(system.A),
        B: parseFloat(system.B),
        C: parseFloat(system.C),
        D: parseFloat(system.D),
        color: system.color,
        is_anchor: system.is_anchor === true || system.is_anchor === '1' || system.is_anchor === 'true'
      };

      // Calculate new confidence based on validation errors
      const newConfidence = calculateConfidence(baseSystem, validationData, systemPositions);
      
      return {
        ...baseSystem,
        confidence: newConfidence
      };
    });
    
    console.log(`\nConfidence calculation complete for ${updatedSystems.length} systems`);
    
    // Show summary of confidence changes
    const confidenceSummary = {
      high: updatedSystems.filter(s => s.confidence >= 90).length,
      medium: updatedSystems.filter(s => s.confidence >= 50 && s.confidence < 90).length,
      low: updatedSystems.filter(s => s.confidence < 50).length,
      anchors: updatedSystems.filter(s => s.is_anchor).length
    };
    
    console.log('\nConfidence Summary:');
    console.log(`High confidence (90-100%): ${confidenceSummary.high} systems`);
    console.log(`Medium confidence (50-89%): ${confidenceSummary.medium} systems`);
    console.log(`Low confidence (0-49%): ${confidenceSummary.low} systems`);
    console.log(`Anchor systems: ${confidenceSummary.anchors} systems`);
    
    // Update confidence values in database
    console.log('\nUpdating confidence values in database...');
    let updateCount = 0;
    
    for (const system of updatedSystems) {
      await updateSystemConfidence(system.id, system.confidence);
      updateCount++;
      
      if (updateCount % 10 === 0) {
        console.log(`Updated ${updateCount}/${updatedSystems.length} systems...`);
      }
    }
    
    console.log(`Successfully updated confidence values for ${updateCount} systems in database`);
    
    // Optionally save updated data to a CSV file for backup
    const updatedCSV = Papa.unparse(updatedSystems);
    const outputPath = './database_updated_astrometrics.csv';
    fs.writeFileSync(outputPath, updatedCSV);
    console.log(`\nUpdated data saved to: ${outputPath}`);
    
    return updatedSystems;
    
  } catch (error) {
    console.error('Error updating confidence values:', error);
    throw error;
  }
}

// Function to get current confidence values from database
async function getCurrentConfidenceValues() {
  try {
    console.log('Fetching current confidence values from database...');
    
    const systems = await getAllSystems();
    console.log(`\nCurrent confidence values for ${systems.length} systems:`);
    
    systems.forEach(system => {
      console.log(`${system.name}: ${system.confidence || 0}%`);
    });
    
    return systems;
  } catch (error) {
    console.error('Error fetching current data:', error);
    return null;
  }
}

// Function to compare current vs calculated confidence values
async function compareConfidenceValues() {
  try {
    console.log('Comparing current vs calculated confidence values...');
    
    const currentSystems = await getAllSystems();
    const validationData = loadValidationData();
    
    // Create system positions map
    const systemPositions = {};
    currentSystems.forEach(system => {
      systemPositions[system.name] = [parseFloat(system.A), parseFloat(system.B), parseFloat(system.C)];
    });
    
    console.log('\nConfidence Comparison:');
    console.log('System Name | Current | Calculated | Difference');
    console.log('------------|---------|------------|------------');
    
    let totalDifference = 0;
    let comparisonCount = 0;
    
    for (const system of currentSystems) {
      const baseSystem = {
        id: system.id,
        name: system.name,
        A: parseFloat(system.A),
        B: parseFloat(system.B),
        C: parseFloat(system.C),
        D: parseFloat(system.D),
        color: system.color,
        is_anchor: system.is_anchor === true || system.is_anchor === '1' || system.is_anchor === 'true'
      };

      const calculatedConfidence = calculateConfidence(baseSystem, validationData, systemPositions);
      const currentConfidence = system.confidence || 0;
      const difference = calculatedConfidence - currentConfidence;
      
      totalDifference += Math.abs(difference);
      comparisonCount++;
      
      console.log(`${system.name.padEnd(12)} | ${currentConfidence.toString().padStart(7)} | ${calculatedConfidence.toFixed(2).padStart(10)} | ${difference.toFixed(2).padStart(10)}`);
    }
    
    const averageDifference = totalDifference / comparisonCount;
    console.log(`\nAverage difference: ${averageDifference.toFixed(2)}%`);
    
    return { currentSystems, averageDifference };
    
  } catch (error) {
    console.error('Error comparing confidence values:', error);
    return null;
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'update':
        await updateAllConfidenceValues();
        break;
      case 'current':
        await getCurrentConfidenceValues();
        break;
      case 'compare':
        await compareConfidenceValues();
        break;
      default:
        console.log('Usage:');
        console.log('  node backend_update_confidence.js update    - Update all confidence values');
        console.log('  node backend_update_confidence.js current   - Show current confidence values');
        console.log('  node backend_update_confidence.js compare   - Compare current vs calculated values');
    }
  } finally {
    // Close database connection
    await pool.end();
    
    // For SQLite:
    // db.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  updateAllConfidenceValues,
  getCurrentConfidenceValues,
  compareConfidenceValues,
  calculateConfidence
}; 