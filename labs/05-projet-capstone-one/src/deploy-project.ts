import { createApiGateway, ApiGatewayConfig } from './api-gateway';
import { createS3Bucket, S3BucketConfig } from './s3-bucket';
import {
  createDynamoDBTable,
  insertShipData,
  readAllShips,
  getTableInfo,
} from './dynamodb';

/**
 * Fonction principale de déploiement du projet Capstone Maritime Surveillance
 * 
 * Architecture déployée:
 * - S3 Bucket: Stockage des photos de navires (fisher.jpg, tanker.jpg)
 * - DynamoDB: Base de données des navires (id, nom, type, pavillon, etc.)
 * - API Gateway: API REST avec 3 endpoints (GET /ships, /ships/profile/{key}, /ships/photo/{key})
 * - IAM Roles: Permissions pour API Gateway → DynamoDB et API Gateway → S3
 * 
 * Ordre d'exécution (CRITIQUE - ne pas modifier):
 * 1. S3 - Créer bucket + uploader photos (avec mapping fisher.jpg → pecheur-b-001.jpg)
 * 2. DynamoDB - Créer table + insérer data depuis data/ships.json
 * 3. IAM - Vérifier que les rôles existent (via variables d'environnement)
 * 4. API Gateway - Créer API + endpoints + déploiement + API key
 * 
 * Prérequis:
 * - AWS CLI configuré avec --profile aws-labs
 * - Variables d'environnement: DYNAMODB_ROLE_ARN, S3_ROLE_ARN
 * - Fichiers: data/ships.json, assets/*.jpg
 * 
 * Commandes:
 * - Déploiement: npm run deploy
 * - Cleanup: npm run cleanup
 */
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
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 3: IAM Role ARNs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dynamodbRoleArn = process.env['DYNAMODB_ROLE_ARN'];
    const s3RoleArn = process.env['S3_ROLE_ARN'];

    if (!dynamodbRoleArn || !s3RoleArn) {
      console.error('❌ Error: IAM Role ARNs are required');
      console.log('\nPlease set the environment variables:');
      console.log('  export DYNAMODB_ROLE_ARN="arn:aws:iam::474150619989:role/APIGatewayDynamoDBServiceRole"');
      console.log('  export S3_ROLE_ARN="arn:aws:iam::474150619989:role/APIGatewayS3ServiceRole"');
      console.log('\nOr run:');
      console.log('  npm run get-roles');
      console.log('  source the output to set environment variables');
      process.exit(1);
    }

    console.log(`✓ DynamoDB Role: ${dynamodbRoleArn}`);
    console.log(`✓ S3 Role: ${s3RoleArn}`);

    // Step 4: Create API Gateway and Configure Integrations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 4: API Gateway Setup');
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
    console.log(`   • API Key: ${apiResult.apiKey}`);
    console.log(`   • Region: ${apiResult.region}`);
    console.log(`   • Stage: ${apiResult.stageName}`);
    console.log('\n🔗 API Endpoints:');
    console.log(`   • GET ${apiResult.apiUrl}/ships`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/profile/{key}`);
    console.log(`   • GET ${apiResult.apiUrl}/ships/photo/{key}`);
    console.log('\n🔑 Using API Key:');
    console.log(`   Add header: x-api-key: ${apiResult.apiKey}`);
    console.log('\n📸 Uploaded Ship Photos:');
    s3Result.uploadedFiles.forEach(file => {
      console.log(`   • ${file} → s3://${s3Result.bucketName}/${file}`);
    });
    console.log('\n💡 Test with checker/index.html using Live Server');
    console.log('   Enter the API URL and API Key in the form');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Deployment Error:', error);
    process.exit(1);
  }
}

// Execute the main function
deploy();
