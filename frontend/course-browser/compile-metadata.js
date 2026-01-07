#!/usr/bin/env node

/**
 * compile-metadata.js
 * 
 * Combines multiple YAML files into a single metadata.json file
 * to reduce network requests during application load.
 * 
 * Usage: node compile-metadata.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'yaml';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DATA_DIR = resolve(__dirname, 'src/data');
const OUTPUT_FILE = resolve(DATA_DIR, 'metadata.json');

const FILES_TO_COMBINE = [
    { path: resolve(DATA_DIR, 'major.yaml'), key: 'major' },
    { path: resolve(DATA_DIR, 'minor.yaml'), key: 'minor' },
    { path: resolve(DATA_DIR, 'periods.yaml'), key: 'periods' },
    { path: resolve(DATA_DIR, 'organizations.yaml'), key: 'organizations' }
];

function loadYamlFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        return parse(content);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        throw error;
    }
}

function compileMetadata() {
    console.log('Compiling metadata from YAML files...\n');
    
    const metadata = {};
    let totalSize = 0;

    // Load each YAML file and add to metadata object
    for (const { path, key } of FILES_TO_COMBINE) {
        console.log(`Loading ${key}.yaml...`);
        const data = loadYamlFile(path);
        metadata[key] = data;
        
        const size = JSON.stringify(data).length;
        totalSize += size;
        console.log(`   - Loaded ${key}: ${(size / 1024).toFixed(2)} KB`);
    }

    // Write combined metadata to JSON file
    const jsonOutput = JSON.stringify(metadata, null, 2);
    writeFileSync(OUTPUT_FILE, jsonOutput, 'utf8');
    
    const outputSize = jsonOutput.length;
    console.log(`\nSuccessfully compiled metadata.json`);
    console.log(`   Total size: ${(outputSize / 1024).toFixed(2)} KB`);
    console.log(`   Location: ${OUTPUT_FILE}`);
    
    // Show compression stats
    const overhead = outputSize - totalSize;
    const compressionRatio = ((1 - (outputSize / (totalSize + (FILES_TO_COMBINE.length * 200)))) * 100).toFixed(1);
    
    console.log(`\nNetwork savings:`);
    console.log(`   Before: 4 requests (~${((totalSize + 800) / 1024).toFixed(2)} KB + 4 RTTs)`);
    console.log(`   After: 1 request (~${(outputSize / 1024).toFixed(2)} KB + 1 RTT)`);
    console.log(`   Estimated time saved on Fast 4G (174ms RTT): ~${(3 * 174).toFixed(0)}ms`);
}

// Run the script
try {
    compileMetadata();
} catch (error) {
    console.error('\nCompilation failed:', error.message);
    process.exit(1);
}