import { createApiGateway, ApiGatewayConfig } from './api-gateway';
import { createS3Bucket, S3BucketConfig } from './s3-bucket';
import {
  createDynamoDBTable,
  insertShipData,
  readAllShips,
  getTableInfo,
} from './dynamodb';

// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...\n');

    // Configuration
    const bucketName = 'maritime-surveillance-ships-photos';
    const tableName = 'maritime-ships';

    // Step 1: Create S3 Bucket and Upload Ship Photos
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 1: S3 Bucket Setup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const s3Config: S3BucketConfig = {
      bucketName,
      assetsPath: './assets',
    };

    const s3Result = await createS3Bucket(s3Config);

    // Step 2: Create and populate DynamoDB
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 2: DynamoDB Setup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await createDynamoDBTable();
    await insertShipData();
    await readAllShips();
    await getTableInfo();

    // Step 3: Get IAM Role ARNs
    const dynamodbRoleArn = process.env['DYNAMODB_ROLE_ARN'] || 'arn:aws:iam::ACCOUNT_ID:role/APIGatewayDynamoDBServiceRole';
    const s3RoleArn = process.env['S3_ROLE_ARN'] || 'arn:aws:iam::ACCOUNT_ID:role/APIGatewayS3ServiceRole';

    // Step 4: Create API Gateway and Configure Integrations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 3: API Gateway Setup');
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
    console.log(`   • S3 Bucket: ${s3Result.bucketName}`);
    console.log(`   • Uploaded Files: ${s3Result.uploadedFiles.length}`);
    console.log(`   • DynamoDB Table: ${tableName}`);
    console.log(`   • API ID: ${apiResult.apiId}`);
    console.log(`   • API URL: ${apiResult.apiUrl}`);
    console.log(`   • Region: ${apiResult.region}`);
    console.log(`   • Stage: ${apiResult.stageName}`);
    console.log('\n🔗 API Endpoints:');
    console.log(`   • GET ${apiResult.apiUrl}/ships`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/profile/{key}`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/photo/{key}`);
    console.log('\n📸 Uploaded Ship Photos:');
    s3Result.uploadedFiles.forEach(file => {
      console.log(`   • ${file} → s3://${s3Result.bucketName}/${file}`);
    });
    console.log('\n💡 Test with checker/index.html using Live Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Deployment Error:', error);
    process.exit(1);
  }
}

// Execute the main function
deploy();
