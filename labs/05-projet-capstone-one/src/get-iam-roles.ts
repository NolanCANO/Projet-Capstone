/**
 * Helper script to retrieve IAM Role ARNs
 * 
 * This script retrieves the ARNs for the required IAM roles:
 * - APIGatewayDynamoDBServiceRole
 * - APIGatewayS3ServiceRole
 * 
 * Usage:
 *   npx ts-node src/get-iam-roles.ts
 *   AWS_PROFILE=aws-labs npx ts-node src/get-iam-roles.ts
 */

import { IAMClient, GetRoleCommand } from '@aws-sdk/client-iam';

// Get AWS profile from environment or use default
const AWS_PROFILE = process.env['AWS_PROFILE'] || 'aws-labs';
const AWS_REGION = process.env['AWS_REGION'] || 'eu-west-1';

console.log(`Using AWS Profile: ${AWS_PROFILE}`);
console.log(`Using AWS Region: ${AWS_REGION}\n`);

const iamClient = new IAMClient({ 
  region: AWS_REGION,
});

const ROLE_NAMES = {
  dynamodb: 'APIGatewayDynamoDBServiceRole',
  s3: 'APIGatewayS3ServiceRole',
};

async function getRoleArn(roleName: string): Promise<string | null> {
  try {
    const response = await iamClient.send(
      new GetRoleCommand({
        RoleName: roleName,
      })
    );

    return response.Role?.Arn || null;
  } catch (error) {
    console.error(`❌ Error retrieving role ${roleName}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('🔍 Retrieving IAM Role ARNs...\n');

  // Test AWS credentials first
  try {
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: AWS_REGION });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    console.log(`✓ Authenticated as: ${identity.Arn}`);
    console.log(`✓ Account: ${identity.Account}\n`);
  } catch (error) {
    console.error('❌ AWS Authentication failed!');
    console.error('   Make sure you have:');
    console.error('   1. Set AWS_PROFILE environment variable: export AWS_PROFILE=aws-labs');
    console.error('   2. Valid AWS credentials in ~/.aws/credentials or ~/.aws/config');
    console.error('   3. If using SSO: run "aws sso login --profile aws-labs"\n');
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }

  // Get DynamoDB role ARN
  console.log('📋 Fetching APIGatewayDynamoDBServiceRole...');
  const dynamodbArn = await getRoleArn(ROLE_NAMES.dynamodb);
  
  if (dynamodbArn) {
    console.log(`   ✓ Found: ${dynamodbArn}\n`);
  } else {
    console.log(`   ✗ Not found\n`);
  }

  // Get S3 role ARN
  console.log('📋 Fetching APIGatewayS3ServiceRole...');
  const s3Arn = await getRoleArn(ROLE_NAMES.s3);
  
  if (s3Arn) {
    console.log(`   ✓ Found: ${s3Arn}\n`);
  } else {
    console.log(`   ✗ Not found\n`);
  }

  // Print export commands
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Export these as environment variables:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (dynamodbArn) {
    console.log(`export DYNAMODB_ROLE_ARN="${dynamodbArn}"`);
  }
  
  if (s3Arn) {
    console.log(`export S3_ROLE_ARN="${s3Arn}"`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Print alternative: AWS CLI commands
  console.log('💡 Alternative: Use AWS CLI directly:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('aws iam get-role --role-name APIGatewayDynamoDBServiceRole --query \'Role.Arn\' --output text --profile aws-labs');
  console.log('aws iam get-role --role-name APIGatewayS3ServiceRole --query \'Role.Arn\' --output text --profile aws-labs\n');
}

main();

export {};
