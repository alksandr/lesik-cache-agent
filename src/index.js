#!/usr/bin/env node

/**
 * Lesik Cache Agent
 * 
 * Connects to Neptune Web IDE server and serves your local OSRS cache
 * through a WebSocket tunnel. No port forwarding needed!
 * 
 * Usage: neptune-cache-agent ./path/to/cache
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SERVER_URL = process.env.NEPTUNE_SERVER || 'wss://neptune.lesik.site/agent';
const RECONNECT_DELAY = 5000;

// Parse arguments
const cachePath = process.argv[2];

if (!cachePath) {
    console.error('Lesik Cache Agent v0.1.0');
    console.error('');
    console.error('Usage: neptune-cache-agent <cache-path>');
    console.error('');
    console.error('Example: neptune-cache-agent ./cache');
    console.error('         neptune-cache-agent /path/to/osrs-cache');
    process.exit(1);
}

// Resolve and validate cache path
const resolvedPath = path.resolve(cachePath);

if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Cache path does not exist: ${resolvedPath}`);
    process.exit(1);
}

// Check for main_file_cache.dat2 or similar
const cacheFiles = fs.readdirSync(resolvedPath);
const hasCacheFiles = cacheFiles.some(f => 
    f.includes('main_file_cache') || f.includes('cache') || f.endsWith('.idx')
);

if (!hasCacheFiles) {
    console.warn(`Warning: No obvious cache files found in ${resolvedPath}`);
    console.warn('Expected files like main_file_cache.dat2, main_file_cache.idx*, etc.');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 Lesik Cache Agent v0.1.0');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Cache path: ${resolvedPath}`);
console.log(`  Server: ${SERVER_URL}`);
console.log('');

let ws = null;
let sessionToken = null;
let reconnectTimeout = null;

/**
 * Connect to the Neptune server
 */
function connect() {
    console.log('🔌 Connecting to Neptune server...');
    
    ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
        console.log('✅ Connected to Neptune server');
        
        // Register this agent
        send({
            type: 'register',
            agentId: crypto.randomBytes(8).toString('hex'),
            cachePath: resolvedPath,
            cacheFiles: cacheFiles.slice(0, 20), // Send first 20 files as preview
        });
    });
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleMessage(msg);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Disconnected from server');
        sessionToken = null;
        scheduleReconnect();
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
}

/**
 * Handle incoming messages from server
 */
function handleMessage(msg) {
    switch (msg.type) {
        case 'registered':
            sessionToken = msg.sessionToken;
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('  ✨ Agent registered successfully!');
            console.log('');
            console.log(`  Your session token: ${sessionToken}`);
            console.log('');
            console.log('  Open Neptune IDE and enter this token to connect');
            console.log('  to your local cache.');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            console.log('📡 Waiting for requests...');
            break;
            
        case 'request':
            handleRequest(msg);
            break;
            
        case 'error':
            console.error('Server error:', msg.message);
            break;
            
        default:
            console.log('Unknown message type:', msg.type);
    }
}

/**
 * Handle a cache data request
 */
async function handleRequest(msg) {
    const { requestId, action, params } = msg;
    
    console.log(`📥 Request: ${action}`, params || '');
    
    try {
        let result;
        
        switch (action) {
            case 'listFiles':
                result = listFiles(params);
                break;
            case 'readFile':
                result = readFile(params);
                break;
            case 'writeFile':
                result = writeFile(params);
                break;
            case 'getCacheInfo':
                result = getCacheInfo();
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        send({
            type: 'response',
            requestId,
            success: true,
            data: result,
        });
        
        console.log(`📤 Response sent for ${action}`);
        
    } catch (err) {
        send({
            type: 'response',
            requestId,
            success: false,
            error: err.message,
        });
        console.error(`❌ Error handling ${action}:`, err.message);
    }
}

/**
 * List files in cache directory
 */
function listFiles(params) {
    const subdir = params?.subdir || '';
    const targetPath = path.join(resolvedPath, subdir);
    
    if (!targetPath.startsWith(resolvedPath)) {
        throw new Error('Access denied: path traversal attempt');
    }
    
    const files = fs.readdirSync(targetPath, { withFileTypes: true });
    return files.map(f => ({
        name: f.name,
        isDirectory: f.isDirectory(),
        size: f.isDirectory() ? 0 : fs.statSync(path.join(targetPath, f.name)).size,
    }));
}

/**
 * Read a file from the cache
 */
function readFile(params) {
    const { filePath, encoding } = params;
    const targetPath = path.join(resolvedPath, filePath);
    
    if (!targetPath.startsWith(resolvedPath)) {
        throw new Error('Access denied: path traversal attempt');
    }
    
    if (!fs.existsSync(targetPath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    
    const data = fs.readFileSync(targetPath);
    
    // Return as base64 for binary data
    return {
        data: data.toString('base64'),
        size: data.length,
    };
}

/**
 * Write a file to the cache
 */
function writeFile(params) {
    const { filePath, data, encoding } = params;
    const targetPath = path.join(resolvedPath, filePath);
    
    if (!targetPath.startsWith(resolvedPath)) {
        throw new Error('Access denied: path traversal attempt');
    }
    
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    
    // Decode base64 data
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(targetPath, buffer);
    
    return { written: buffer.length };
}

/**
 * Get cache info/stats
 */
function getCacheInfo() {
    const files = fs.readdirSync(resolvedPath);
    let totalSize = 0;
    
    for (const file of files) {
        const stat = fs.statSync(path.join(resolvedPath, file));
        if (stat.isFile()) {
            totalSize += stat.size;
        }
    }
    
    return {
        path: resolvedPath,
        fileCount: files.length,
        totalSize,
        files: files.slice(0, 50), // First 50 files
    };
}

/**
 * Send a message to the server
 */
function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

/**
 * Schedule reconnection
 */
function scheduleReconnect() {
    if (reconnectTimeout) return;
    
    console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connect();
    }, RECONNECT_DELAY);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    if (ws) ws.close();
    process.exit(0);
});

// Start connection
connect();
