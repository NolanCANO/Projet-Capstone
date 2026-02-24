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
