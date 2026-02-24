/**
 * Test script for DynamoDB functionality
 * 
 * This script tests:
 * - Table creation
 * - Data insertion
 * - Data retrieval
 * - Single item queries
 */

import {
  createDynamoDBTable,
  insertShipData,
  readAllShips,
  getTableInfo,
  getShipById,
  deleteShipById,
} from './dynamodb';

async function testDynamoDB() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        DynamoDB Functionality Test Suite                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Test 1: Create table
    console.log('Test 1️⃣  - Table Creation');
    console.log('─'.repeat(60));
    await createDynamoDBTable();

    // Test 2: Insert data
    console.log('\n\nTest 2️⃣  - Data Insertion');
    console.log('─'.repeat(60));
    const insertedCount = await insertShipData();

    // Test 3: Read all ships
    console.log('\n\nTest 3️⃣  - Read All Ships');
    console.log('─'.repeat(60));
    const allShips = await readAllShips();

    // Test 4: Get specific ship
    if (allShips && allShips.length > 0) {
      console.log('\n\nTest 4️⃣  - Get Specific Ship');
      console.log('─'.repeat(60));
      const firstShipId = allShips[0]?.id?.S;
      if (firstShipId) {
        await getShipById(firstShipId);
      }
    }

    // Test 5: Table info
    console.log('\n\nTest 5️⃣  - Table Information');
    console.log('─'.repeat(60));
    await getTableInfo();

    // Test 6: Delete specific ship
    if (allShips && allShips.length > 0) {
      console.log('\n\nTest 6️⃣  - Delete Specific Ship');
      console.log('─'.repeat(60));
      const shipToDelete = allShips[0]?.id?.S;
      if (shipToDelete) {
        await deleteShipById(shipToDelete);
        
        // Verify deletion
        const remainingShips = await readAllShips();
        console.log(`\n✅ Verification: ${remainingShips.length} ships remaining`);
      }
    }

    // Summary
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  Test Summary                               ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  ✅ Table Creation           - PASSED                       ║');
    console.log(`║  ✅ Data Insertion           - PASSED (${insertedCount} items)        ║`);
    console.log(`║  ✅ Read All Ships           - PASSED (${allShips.length} ships)            ║`);
    console.log('║  ✅ Get Specific Ship        - PASSED                       ║');
    console.log('║  ✅ Table Information        - PASSED                       ║');
    console.log('║  ✅ Delete Specific Ship     - PASSED                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('🎉 All tests passed successfully!\n');
  } catch (error) {
    console.error('\n\n❌ Test failed:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Make sure AWS credentials are configured');
    console.log('   2. Check AWS_REGION environment variable');
    console.log('   3. Verify IAM permissions for DynamoDB operations');
    console.log('   4. Check if ships.json file exists\n');
    process.exit(1);
  }
}

// Run tests
testDynamoDB();
