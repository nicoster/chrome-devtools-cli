#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Build script for Chrome DevTools CLI
 * Handles different build configurations and environments
 */

const BUILD_MODES = {
  development: 'tsconfig.json',
  production: 'tsconfig.prod.json'
};

function log(message) {
  console.log(`[BUILD] ${message}`);
}

function error(message) {
  console.error(`[BUILD ERROR] ${message}`);
  process.exit(1);
}

function executeCommand(command, description) {
  log(description);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (err) {
    error(`Failed to ${description.toLowerCase()}: ${err.message}`);
  }
}

function ensureDistDirectory() {
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
    log('Created dist directory');
  }
}

function makeExecutable() {
  const indexPath = path.join(process.cwd(), 'dist', 'index.js');
  if (fs.existsSync(indexPath)) {
    try {
      fs.chmodSync(indexPath, '755');
      log('Made dist/index.js executable');
    } catch (err) {
      log(`Warning: Could not make index.js executable: ${err.message}`);
    }
  }
}

function validateBuild() {
  const requiredFiles = ['dist/index.js'];
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    error(`Build validation failed. Missing files: ${missingFiles.join(', ')}`);
  }
  
  log('Build validation passed');
}

function main() {
  const mode = process.argv[2] || 'development';
  const configFile = BUILD_MODES[mode];
  
  if (!configFile) {
    error(`Invalid build mode: ${mode}. Available modes: ${Object.keys(BUILD_MODES).join(', ')}`);
  }
  
  log(`Building in ${mode} mode using ${configFile}`);
  
  // Clean previous build
  executeCommand('npm run clean', 'Cleaning previous build');
  
  // Ensure dist directory exists
  ensureDistDirectory();
  
  // Run TypeScript compilation
  executeCommand(`tsc -p ${configFile}`, 'Compiling TypeScript');
  
  // Make the main file executable
  makeExecutable();
  
  // Validate build output
  validateBuild();
  
  log(`Build completed successfully in ${mode} mode`);
}

if (require.main === module) {
  main();
}

module.exports = { main };