import { deleteApiGateway } from './api-gateway';
import { deleteS3Bucket } from './s3-bucket';
import { clearTableData, deleteDynamoDBTable } from './dynamodb';

// Main function to execute destructive operation
async function main() {
  try {
    console.log('🗑️  Starting Project Deletion...\n');

    // Get configuration
    const apiId = process.argv[2] || process.env['API_GATEWAY_ID'];
    const bucketName = process.env['BUCKET_NAME'] || 'maritime-surveillance-ships-photos';

    if (!apiId) {
      console.error('❌ Error: API Gateway ID is required');
      console.log('\nUsage:');
      console.log('  npx ts-node src/destroy-project.ts <API_GATEWAY_ID>');
      console.log('\nOr set the environment variable:');
      console.log('  export API_GATEWAY_ID=your-api-id');
      console.log('  npx ts-node src/destroy-project.ts');
      process.exit(1);
    }

    // Step 1: Delete API Gateway
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 1: Deleting API Gateway...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await deleteApiGateway(apiId);

    // Step 2: Delete DynamoDB Items and Table
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 2: Deleting DynamoDB Table...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
      // First clear all items from the table
      await clearTableData();
      
      // Then delete the table itself
      await deleteDynamoDBTable();
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('⚠️  DynamoDB table does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Step 3: Delete S3 Bucket and Objects
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 3: Deleting S3 Bucket...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await deleteS3Bucket(bucketName);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Project Deleted Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Deletion Error:', error);
    process.exit(1);
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
