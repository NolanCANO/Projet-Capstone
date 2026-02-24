import { deleteApiGateway } from './api-gateway';

// Main function to execute destructive operation
async function main() {
  try {
    console.log('🗑️  Starting Project Deletion...\n');

    // Get API ID from command line argument or environment variable
    const apiId = process.argv[2] || process.env['API_GATEWAY_ID'];

    if (!apiId) {
      console.error('❌ Error: API Gateway ID is required');
      console.log('\nUsage:');
      console.log('  npx ts-node src/destroy-project.ts <API_GATEWAY_ID>');
      console.log('\nOr set the environment variable:');
      console.log('  export API_GATEWAY_ID=your-api-id');
      console.log('  npx ts-node src/destroy-project.ts');
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Deleting API Gateway...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Delete API Gateway
    await deleteApiGateway(apiId);

    // TODO: Delete DynamoDB Items and Table
    console.log('\n🗄️  DynamoDB cleanup (to be implemented)');

    // TODO: Delete S3 Objects and Bucket
    console.log('📦 S3 cleanup (to be implemented)');

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
