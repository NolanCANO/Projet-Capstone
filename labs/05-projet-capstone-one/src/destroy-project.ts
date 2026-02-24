import { deleteApiGateway } from './api-gateway';
import { deleteS3Bucket } from './s3-bucket';

// Main function to execute destructive operation
async function main() {
  try {
    console.log('🗑️  Starting Project Deletion...\n');

    // Get configuration
    const apiId = process.argv[2] || process.env['API_GATEWAY_ID'];
    const bucketName = process.env['BUCKET_NAME'] || 'maritime-surveillance-ships-photos';
    const tableName = process.env['TABLE_NAME'] || 'maritime-ships';

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

    // Step 2: Delete DynamoDB (TODO)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 2: DynamoDB cleanup (TODO)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`🗄️  Table: ${tableName} (to be implemented)`);

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
