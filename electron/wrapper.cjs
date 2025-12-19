// This wrapper allows Electron to properly load the ES module
// Electron has issues with direct .mjs files in some versions

const { pathToFileURL } = require('url');
const path = require('path');

// Import the actual main module
const mainPath = path.join(__dirname, 'main.mjs');
import(pathToFileURL(mainPath).href).catch(err => {
  console.error('Failed to load main module:', err);
  process.exit(1);
});
