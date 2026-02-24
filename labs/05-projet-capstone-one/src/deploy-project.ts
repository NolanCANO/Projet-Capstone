import { createApiGateway, ApiGatewayConfig } from './api-gateway';

// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...\n');

    // TODO: Create S3 and Insert Objects
    const bucketName = 'maritime-surveillance-ships-photos'; // Replace with your bucket name
    console.log('📦 S3 Bucket (assumed created):', bucketName);

    // TODO: Create DynamoDB and Insert Items
    const tableName = 'maritime-ships'; // Replace with your table name
    console.log('🗄️  DynamoDB Table (assumed created):', tableName);

    // Get IAM Role ARNs (must be retrieved from AWS)
    // Run these commands to get the ARNs:
    // aws iam get-role --role-name APIGatewayDynamoDBServiceRole --query 'Role.Arn' --output text --profile aws-labs
    // aws iam get-role --role-name APIGatewayS3ServiceRole --query 'Role.Arn' --output text --profile aws-labs
    const dynamodbRoleArn = process.env['DYNAMODB_ROLE_ARN'] || 'arn:aws:iam::ACCOUNT_ID:role/APIGatewayDynamoDBServiceRole';
    const s3RoleArn = process.env['S3_ROLE_ARN'] || 'arn:aws:iam::ACCOUNT_ID:role/APIGatewayS3ServiceRole';

    // Create API Gateway and Configure S3 / DynamoDB Integration
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Creating API Gateway...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const apiConfig: ApiGatewayConfig = {
      bucketName,
      tableName,
      dynamodbRoleArn,
      s3RoleArn,
    };

    const apiResult = await createApiGateway(apiConfig);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Project Deployed Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Deployment Summary:');
    console.log(`   • API ID: ${apiResult.apiId}`);
    console.log(`   • API URL: ${apiResult.apiUrl}`);
    console.log(`   • Region: ${apiResult.region}`);
    console.log(`   • Stage: ${apiResult.stageName}`);
    console.log('\n🔗 API Endpoints:');
    console.log(`   • GET ${apiResult.apiUrl}/ships`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/profile/{key}`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/photo/{key}`);
    console.log('\n💡 Test with checker/index.html using Live Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Deployment Error:', error);
    process.exit(1);
  }
}

// Execute the main function
deploy();

/**
 * Create DynamoDB table for storing ship profiles
 * Table name: ShipsProfiles
 * Partition Key: id (String)
 * Billing Mode: Pay Per Request
 */
async function createTable(): Promise<void> {
  console.log(`\n📋 Checking if table "${TABLE_NAME}" exists...`);

  try {
    // List existing tables
    const listTablesCommand = new ListTablesCommand({});
    const listTablesResult = await dynamoDBClient.send(listTablesCommand);

    const tableExists = listTablesResult.TableNames?.includes(TABLE_NAME);

    if (tableExists) {
      console.log(`✅ Table "${TABLE_NAME}" already exists.`);
      return;
    }

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
  } catch (error) {
    if (
      error instanceof Error &&
      error.message &&
      error.message.includes('ResourceInUseException')
    ) {
      console.log(`✅ Table "${TABLE_NAME}" already exists.`);
    } else {
      throw error;
    }
  }
}

/**
 * Load and insert ship data into DynamoDB from ships.json
 */
async function insertShipData(): Promise<void> {
  console.log(`\n📥 Loading ship data from "${SHIPS_DATA_FILE}"...`);

  // Read and parse ships.json
  const shipsData = JSON.parse(fs.readFileSync(SHIPS_DATA_FILE, 'utf-8'));
  console.log(`   Found ${shipsData.length} ships to insert.`);

  for (const ship of shipsData) {
    console.log(`\n   📍 Inserting ship: ${ship.id.S} - ${ship.nom.S}...`);

    const putItemCommand = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: ship as Record<string, AttributeValue>,
    });

    try {
      await dynamoDBClient.send(putItemCommand);
      console.log(`      ✅ Ship ${ship.id.S} inserted successfully!`);
    } catch (error) {
      console.error(`      ❌ Failed to insert ship ${ship.id.S}:`, error);
      throw error;
    }
  }

  console.log(`\n✅ All ships inserted into DynamoDB!`);
}

/**
 * Read and display all ships from DynamoDB
 */
async function readShipData(): Promise<void> {
  console.log(`\n📖 Reading all ships from DynamoDB table "${TABLE_NAME}"...`);

  const scanCommand = new ScanCommand({
    TableName: TABLE_NAME,
  });

  try {
    const scanResult = await dynamoDBClient.send(scanCommand);
    console.log(
      `✅ Retrieved ${scanResult.Items?.length || 0} ships from DynamoDB:`
    );

    if (scanResult.Items && scanResult.Items.length > 0) {
      console.log('\n📊 Ships Data:');
      console.log(JSON.stringify(scanResult.Items, null, 2));
    } else {
      console.log('   No ships found in the table.');
    }

    return scanResult.Items;
  } catch (error) {
    console.error('❌ Error reading ships from DynamoDB:', error);
    throw error;
  }
}

/**
 * Get table details and statistics
 */
async function getTableInfo(): Promise<void> {
  console.log(`\n📊 Getting table information for "${TABLE_NAME}"...`);

  const describeTableCommand = new DescribeTableCommand({
    TableName: TABLE_NAME,
  });

  try {
    const tableInfo = await dynamoDBClient.send(describeTableCommand);
    console.log('✅ Table Information:');
    console.log(`   Name: ${tableInfo.Table?.TableName}`);
    console.log(`   Status: ${tableInfo.Table?.TableStatus}`);
    console.log(`   Item Count: ${tableInfo.Table?.ItemCount}`);
    console.log(`   Billing Mode: ${tableInfo.Table?.BillingModeSummary?.BillingMode}`);
    console.log(`   ARN: ${tableInfo.Table?.TableArn}`);
  } catch (error) {
    console.error('❌ Error getting table information:', error);
    throw error;
  }
}

// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');
    console.log('='.repeat(60));

    // Step 1: Create DynamoDB Table
    await createTable();

    // Step 2: Insert Ship Data
    await insertShipData();

    // Step 3: Read and Display Ship Data
    await readShipData();

    // Step 4: Get Table Information
    await getTableInfo();

    console.log('\n' + '='.repeat(60));
    console.log('✅ DynamoDB deployment completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error during deployment:', error);
    process.exit(1);
  }
}

// Execute the main function
deploy();
>>>>>>> Stashed changes
