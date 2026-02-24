import * as fs from 'fs';
import * as path from 'path';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  PutItemCommand,
  ScanCommand,
  GetItemCommand,
  DeleteItemCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';

// Configuration
const TABLE_NAME = 'maritime-ships';
const REGION = process.env['AWS_REGION'] || 'eu-west-1';
const SHIPS_DATA_FILE = path.join(__dirname, '../data/ships.json');

// Initialize DynamoDB client
const dynamoDBClient = new DynamoDBClient({ region: REGION });

/**
 * Ship data interface
 */
export interface ShipData {
  id: { S: string };
  nom: { S: string };
  type: { S: string };
  pavillon: { S: string };
  taille: { N: string };
  nombre_marins: { N: string };
  s3_image_key: { S: string };
}

/**
 * Create DynamoDB table for storing ship profiles
 * 
 * Configuration de la table:
 * - Nom: maritime-ships
 * - Clé primaire: id (String) - HASH key (partition key)
 * - Billing mode: PAY_PER_REQUEST (pas de capacité provisionnée)
 *   Avantage: coût basé sur l'utilisation réelle, pas de limite fixe
 * 
 * Schéma des items:
 * {
 *   id: "B-001",
 *   nom: "Le Pêcheur Breton",
 *   type: "Fishing",
 *   pavillon: "France",
 *   taille: 45,
 *   nombre_marins: 12,
 *   s3_image_key: "pecheur-b-001.jpg"
 * }
 * 
 * La fonction vérifie d'abord si la table existe pour éviter les erreurs
 */
export async function createDynamoDBTable(): Promise<void> {
  console.log(`\n📋 Checking if table "${TABLE_NAME}" exists...`);

  try {
    // Check if table exists (évite ResourceInUseException)
    const describeCommand = new DescribeTableCommand({ TableName: TABLE_NAME });
    try {
      const result = await dynamoDBClient.send(describeCommand);
      console.log(`✅ Table "${TABLE_NAME}" already exists.`);
      console.log(`   Status: ${result.Table?.TableStatus}`);
      console.log(`   Items: ${result.Table?.ItemCount}`);
      return;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table if it doesn't exist
    console.log(`\n📊 Creating DynamoDB table "${TABLE_NAME}"...`);

    const createTableCommand = new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH', // Partition Key
        },
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S', // String
        },
      ],
      BillingMode: 'PAY_PER_REQUEST', // Pay per request (no provisioned capacity)
    });

    const createTableResult = await dynamoDBClient.send(createTableCommand);
    console.log(`✅ Table "${TABLE_NAME}" created successfully!`);
    console.log(`   Status: ${createTableResult.TableDescription?.TableStatus}`);
    console.log(`   ARN: ${createTableResult.TableDescription?.TableArn}`);

    // Wait for table to be active
    console.log('\n⏳ Waiting for table to be active...');
    await waitForTableActive();
    console.log('✅ Table is now active!');
  } catch (error) {
    console.error('❌ Error creating DynamoDB table:', error);
    throw error;
  }
}

/**
 * Wait for table to become ACTIVE
 */
async function waitForTableActive(maxAttempts: number = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const describeCommand = new DescribeTableCommand({ TableName: TABLE_NAME });
      const result = await dynamoDBClient.send(describeCommand);

      if (result.Table?.TableStatus === 'ACTIVE') {
        return;
      }

      // Wait 1 second before next attempt
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Table doesn't exist yet
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Table "${TABLE_NAME}" did not become active within ${maxAttempts} seconds`);
}

/**
 * Load and insert ship data into DynamoDB from ships.json
 */
export async function insertShipData(): Promise<number> {
  console.log(`\n📥 Loading ship data from "${path.basename(SHIPS_DATA_FILE)}"...`);

  try {
    // Read and parse ships.json
    const shipsData: ShipData[] = JSON.parse(fs.readFileSync(SHIPS_DATA_FILE, 'utf-8'));
    console.log(`   Found ${shipsData.length} ships to insert.`);

    let insertedCount = 0;

    for (const ship of shipsData) {
      const shipId = ship.id.S;
      const shipName = ship.nom.S;

      console.log(`\n   📍 Inserting ship: ${shipId} (${shipName})...`);

      const putItemCommand = new PutItemCommand({
        TableName: TABLE_NAME,
        Item: ship as unknown as Record<string, AttributeValue>,
      });

      try {
        await dynamoDBClient.send(putItemCommand);
        console.log(`      ✅ Ship inserted successfully!`);
        insertedCount++;
      } catch (error) {
        console.error(`      ❌ Failed to insert ship:`, error);
        throw error;
      }
    }

    console.log(`\n✅ All ${insertedCount} ships inserted into DynamoDB!`);
    return insertedCount;
  } catch (error) {
    console.error('❌ Error inserting ship data:', error);
    throw error;
  }
}

/**
 * Read and display all ships from DynamoDB
 */
export async function readAllShips(): Promise<ShipData[]> {
  console.log(`\n📖 Reading all ships from DynamoDB table "${TABLE_NAME}"...`);

  try {
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const scanResult = await dynamoDBClient.send(scanCommand);
    const ships = (scanResult.Items || []) as unknown as ShipData[];

    console.log(`✅ Retrieved ${ships.length} ships from DynamoDB:`);

    if (ships.length > 0) {
      console.log('\n📊 Ships in Database:');
      ships.forEach((ship) => {
        console.log(`   • ${ship.id.S} - ${ship.nom.S} (${ship.type.S})`);
      });
    } else {
      console.log('   No ships found in the table.');
    }

    return ships;
  } catch (error) {
    console.error('❌ Error reading ships from DynamoDB:', error);
    throw error;
  }
}

/**
 * Get a specific ship by ID
 */
export async function getShipById(shipId: string): Promise<ShipData | null> {
  console.log(`\n🔍 Getting ship with ID: ${shipId}...`);

  try {
    const getItemCommand = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        id: { S: shipId },
      },
    });

    const result = await dynamoDBClient.send(getItemCommand);

    if (result.Item) {
      const ship = result.Item as unknown as ShipData;
      console.log(`✅ Found ship: ${ship.nom.S}`);
      console.log(JSON.stringify(ship, null, 2));
      return ship;
    } else {
      console.log(`⚠️  Ship with ID "${shipId}" not found.`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting ship:', error);
    throw error;
  }
}

/**
 * Get table details and statistics
 */
export async function getTableInfo(): Promise<void> {
  console.log(`\n📊 Getting table information for "${TABLE_NAME}"...`);

  try {
    const describeTableCommand = new DescribeTableCommand({
      TableName: TABLE_NAME,
    });

    const tableInfo = await dynamoDBClient.send(describeTableCommand);
    const table = tableInfo.Table;

    if (!table) {
      console.log('❌ Table not found');
      return;
    }

    console.log('✅ Table Information:');
    console.log(`   Name: ${table.TableName}`);
    console.log(`   Status: ${table.TableStatus}`);
    console.log(`   Item Count: ${table.ItemCount}`);
    console.log(`   Billing Mode: ${table.BillingModeSummary?.BillingMode}`);
    console.log(`   ARN: ${table.TableArn}`);
    console.log(`   Created: ${table.CreationDateTime}`);
  } catch (error) {
    console.error('❌ Error getting table information:', error);
    throw error;
  }
}

/**
 * Delete a specific ship by ID
 */
export async function deleteShipById(shipId: string): Promise<boolean> {
  console.log(`\n🗑️  Deleting ship with ID: ${shipId}...`);

  try {
    const deleteItemCommand = new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        id: { S: shipId },
      },
    });

    await dynamoDBClient.send(deleteItemCommand);
    console.log(`✅ Ship "${shipId}" deleted successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting ship "${shipId}":`, error);
    throw error;
  }
}

/**
 * Delete the DynamoDB table
 */
export async function deleteDynamoDBTable(): Promise<void> {
  console.log(`\n🗑️  Deleting DynamoDB table "${TABLE_NAME}"...`);

  try {
    const deleteTableCommand = new DeleteTableCommand({
      TableName: TABLE_NAME,
    });

    const result = await dynamoDBClient.send(deleteTableCommand);
    console.log(`✅ Table "${TABLE_NAME}" deletion initiated.`);
    console.log(`   Status: ${result.TableDescription?.TableStatus}`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`⚠️  Table "${TABLE_NAME}" does not exist.`);
    } else {
      console.error('❌ Error deleting table:', error);
      throw error;
    }
  }
}

/**
 * Clear all data from the table (delete and recreate)
 */
export async function clearTableData(): Promise<void> {
  console.log(`\n🧹 Clearing all data from table "${TABLE_NAME}"...`);

  try {
    // Get all items
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const scanResult = await dynamoDBClient.send(scanCommand);
    const items = (scanResult.Items || []) as unknown as ShipData[];

    console.log(`Found ${items.length} items to delete.`);

    // Delete each item individually
    for (const item of items) {
      const shipId = item.id.S;
      console.log(`   Deleting: ${shipId}`);
      
      const deleteItemCommand = new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          id: { S: shipId },
        },
      });

      await dynamoDBClient.send(deleteItemCommand);
    }

    console.log('✅ Table data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing table data:', error);
    throw error;
  }
}

export { TABLE_NAME, REGION };
