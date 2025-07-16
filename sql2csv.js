import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const BACKEND_URL = 'http://192.168.1.96:3000/systems';
const OUTPUT_FILE = 'euclid_systems_backup.csv';

// Function to convert system data to CSV format
function convertToCSV(systems) {
  if (!systems || systems.length === 0) {
    console.log('No systems data found');
    return '';
  }

  // Get all unique keys from all systems
  const allKeys = new Set();
  systems.forEach(system => {
    Object.keys(system).forEach(key => allKeys.add(key));
  });

  // Convert Set to Array and sort for consistent output
  const headers = Array.from(allKeys).sort();

  // Create CSV header row
  const csvHeader = headers.map(header => `"${header}"`).join(',');

  // Create CSV data rows
  const csvRows = systems.map(system => {
    return headers.map(header => {
      const value = system[header];
      // Handle different data types and escape quotes
      if (value === null || value === undefined) {
        return '""';
      } else if (typeof value === 'string') {
        // Escape quotes and wrap in quotes
        return `"${value.replace(/"/g, '""')}"`;
      } else if (typeof value === 'object') {
        // Convert objects to JSON strings
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      } else {
        // Numbers, booleans, etc.
        return `"${value}"`;
      }
    }).join(',');
  });

  // Combine header and rows
  return [csvHeader, ...csvRows].join('\n');
}

// Function to fetch data from backend
async function fetchSystemData() {
  try {
    console.log('Fetching system data from backend...');
    const response = await fetch(BACKEND_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Successfully fetched ${data.length} systems`);
    return data;
  } catch (error) {
    console.error('Error fetching system data:', error.message);
    throw error;
  }
}

// Function to save CSV to file
function saveCSVToFile(csvContent, filename) {
  try {
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`CSV file saved successfully: ${filename}`);
    
    // Get file size
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
    console.log(`File size: ${fileSizeInKB} KB`);
    
  } catch (error) {
    console.error('Error saving CSV file:', error.message);
    throw error;
  }
}

// Function to create a summary report
function createSummary(systems) {
  const summary = {
    totalSystems: systems.length,
    anchorSystems: systems.filter(s => s.is_anchor).length,
    nonAnchorSystems: systems.filter(s => !s.is_anchor).length,
    galaxies: [...new Set(systems.map(s => s.galaxy).filter(Boolean))],
    regions: [...new Set(systems.map(s => s.region).filter(Boolean))],
    dataFields: Object.keys(systems[0] || {}),
    timestamp: new Date().toISOString()
  };

  console.log('\n=== DATA SUMMARY ===');
  console.log(`Total Systems: ${summary.totalSystems}`);
  console.log(`Anchor Systems: ${summary.anchorSystems}`);
  console.log(`Non-Anchor Systems: ${summary.nonAnchorSystems}`);
  console.log(`Unique Galaxies: ${summary.galaxies.length}`);
  console.log(`Unique Regions: ${summary.regions.length}`);
  console.log(`Data Fields: ${summary.dataFields.join(', ')}`);
  console.log(`Export Time: ${summary.timestamp}`);
  console.log('===================\n');

  return summary;
}

// Main function
async function main() {
  try {
    console.log('Starting SQL to CSV conversion...\n');

    // Fetch data from backend
    const systems = await fetchSystemData();

    // Create summary
    const summary = createSummary(systems);

    // Convert to CSV
    console.log('Converting data to CSV format...');
    const csvContent = convertToCSV(systems);

    // Save to file
    saveCSVToFile(csvContent, OUTPUT_FILE);

    // Save summary as JSON
    const summaryFile = 'export_summary.json';
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Summary saved: ${summaryFile}`);

    console.log('\n✅ Conversion completed successfully!');
    console.log(`📁 Output file: ${OUTPUT_FILE}`);
    console.log(`📊 Summary file: ${summaryFile}`);

  } catch (error) {
    console.error('\n❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main(); 