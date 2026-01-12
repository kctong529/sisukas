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
    let totalOriginalSize = 0;

    // Load each YAML file and calculate size
    for (const { path, key } of FILES_TO_COMBINE) {
        console.log(`Loading ${key}.yaml...`);
        const data = loadYamlFile(path);
        metadata[key] = data;

        const size = JSON.stringify(data).length;
        totalOriginalSize += size;
        console.log(`   - Loaded ${key}: ${(size / 1024).toFixed(2)} KB`);
    }

    // Write pretty JSON to disk
    const prettyJson = JSON.stringify(metadata, null, 2);
    writeFileSync(OUTPUT_FILE, prettyJson, 'utf8');

    // Minified JSON for stats
    const minifiedJson = JSON.stringify(metadata);
    const outputSize = minifiedJson.length;

    const overhead = outputSize - totalOriginalSize;
    const compressionRatio = ((1 - outputSize / totalOriginalSize) * 100).toFixed(1);

    console.log(`\nSuccessfully compiled metadata.json`);
    console.log(`   Total size (pretty): ${(prettyJson.length / 1024).toFixed(2)} KB`);
    console.log(`   Location: ${OUTPUT_FILE}`);

    console.log(`\nNetwork savings (approx.):`);
    console.log(`   Original size: ${(totalOriginalSize / 1024).toFixed(2)} KB across ${FILES_TO_COMBINE.length} requests`);
    console.log(`   Minified JSON: ${(outputSize / 1024).toFixed(2)} KB in 1 request`);
    console.log(`   Overhead from combining: ${(overhead / 1024).toFixed(2)} KB`);
    console.log(`   Compression ratio: ${compressionRatio}%`);
    console.log(`   Estimated time saved on Fast 4G (174ms RTT per request): ~${((FILES_TO_COMBINE.length - 1) * 174).toFixed(0)}ms`);
}

// Run the script
try {
    compileMetadata();
} catch (error) {
    console.error('\nCompilation failed:', error.message);
    process.exit(1);
}
