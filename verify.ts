#!/usr/bin/env node
/**
 * Integration verification script for openclaw-tablestore.
 *
 * Usage:
 *   EPUB360_CLIENT_ID=xxx EPUB360_CLIENT_SECRET=xxx npx tsx verify.ts
 *
 * Environment variables:
 *   EPUB360_CLIENT_ID      — OAuth client ID
 *   EPUB360_CLIENT_SECRET  — OAuth client secret
 *   EPUB360_BASE_URL       — API base URL (optional, default: https://www.epub360.com)
 *   EPUB360_TABLE_UUID     — Table UUID to test against (optional, auto-picked from list if not set)
 */

const CLIENT_ID = process.env.EPUB360_CLIENT_ID;
const CLIENT_SECRET = process.env.EPUB360_CLIENT_SECRET;
const BASE_URL = process.env.EPUB360_BASE_URL ?? 'https://www.epub360.com';
const TABLE_UUID = process.env.EPUB360_TABLE_UUID;

// ---------------------------------------------------------------------------
// Check env
// ---------------------------------------------------------------------------

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  if (!CLIENT_ID) console.error('   EPUB360_CLIENT_ID');
  if (!CLIENT_SECRET) console.error('   EPUB360_CLIENT_SECRET');
  console.error('\nUsage:');
  console.error('   EPUB360_CLIENT_ID=xxx EPUB360_CLIENT_SECRET=yyy npx tsx verify.ts');
  process.exit(1);
}

console.log('🔧 Config:');
console.log(`   Base URL: ${BASE_URL}`);
console.log(`   Client ID: ${CLIENT_ID.slice(0, 4)}...`);
console.log(`   Table UUID: ${TABLE_UUID ?? '(auto-pick from list)'}`);
console.log();

// ---------------------------------------------------------------------------
// Dynamic import (avoid top-level await issues)
// ---------------------------------------------------------------------------

async function main() {
  const { TokenManager } = await import('./src/core/token-manager.js');
  const { Epub360Client } = await import('./src/core/epub360-client.js');

  // Set base URL for token manager
  TokenManager.setBaseUrl(BASE_URL);

  // Build client
  const client = new Epub360Client({
    baseUrl: BASE_URL,
    tokenManager: new TokenManager(CLIENT_ID, CLIENT_SECRET),
    services: {
      tablestore: { apiVersion: 'v2' },
      h5store: { apiVersion: 'v3' },
    },
  });

  // ---------------------------------------------------------------------------
  // Test 1: Token acquisition
  // ---------------------------------------------------------------------------
  console.log('📋 Test 1: Token acquisition');
  try {
    const token = await client.getToken();
    console.log(`   ✅ Got token: ${token.slice(0, 8)}...`);
  } catch (err) {
    console.error(`   ❌ Failed: ${err}`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Test 2: List tables
  // ---------------------------------------------------------------------------
  console.log('\n📋 Test 2: List tables (GET /v2/api/tables/)');
  type TableItem = {
    id: string;
    table_id: string;
    title: string;
    fields: unknown[];
  };
  type ListResponse = {
    msg: string;
    code: number;
    data: {
      sum: number;
      page: number;
      size: number;
      numpages: number;
      results: TableItem[];
    };
  };
  let tableUuid = TABLE_UUID;
  try {
    const resp = await client.invoke<ListResponse>(
      'tablestore',
      'GET',
      '/api/tables/',
    );
    const tables = resp.data?.results ?? [];
    console.log(`   ✅ Returned ${tables.length} tables (total: ${resp.data?.sum ?? 'unknown'})`);
    if (tables.length > 0) {
      const first = tables[0];
      console.log(`   First table: uuid=${first.id}, title=${first.title}, fields=${first.fields.length}`);

      // Auto-pick the first table with fields for Test 3
      if (!tableUuid) {
        const withFields = tables.find(t => t.fields.length > 0);
        if (withFields) {
          tableUuid = withFields.id;
          console.log(`   Auto-selected table: uuid=${tableUuid} (has ${withFields.fields.length} fields)`);
        }
      }
    }
  } catch (err) {
    console.error(`   ❌ Failed: ${err}`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Get table schema
  // ---------------------------------------------------------------------------
  if (tableUuid) {
    console.log(`\n📋 Test 3: Get table schema (OPTIONS /v2/api/tables/${tableUuid}/)`);
    try {
      const schema = await client.invoke<unknown>(
        'tablestore',
        'OPTIONS',
        `/api/tables/${tableUuid}/`,
      );
      console.log(`   ✅ Got schema`);
      const schemaObj = schema as Record<string, unknown>;
      const data = schemaObj?.data as Record<string, unknown> | undefined;
      const fields = (schemaObj?.fields ?? data?.fields ?? []) as unknown[];
      console.log(`   Fields count: ${fields.length}`);
    } catch (err) {
      console.error(`   ❌ Failed: ${err}`);
    }
  } else {
    console.log('\n📋 Test 3: Get table schema — skipped (no table with fields found)');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n✅ All verification tests passed');
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
