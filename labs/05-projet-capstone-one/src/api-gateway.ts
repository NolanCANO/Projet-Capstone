/**
 * API Gateway Configuration Module
 * 
 * This module handles the creation and configuration of API Gateway
 * for the Maritime Surveillance System.
 * 
 * Endpoints:
 * - GET /ships - List all ships from DynamoDB
 * - GET /ships/profile/{key} - Get ship profile from DynamoDB
 * - GET /ships/photo/{key} - Get ship photo from S3
 */

import {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  PutMethodResponseCommand,
  PutIntegrationResponseCommand,
  CreateDeploymentCommand,
  DeleteRestApiCommand,
  PutGatewayResponseCommand,
} from '@aws-sdk/client-api-gateway';

// Configuration
const AWS_REGION = 'eu-west-1';
const API_NAME = 'maritime-surveillance-api';
const STAGE_NAME = 'prod';

// Initialize client
const apiGatewayClient = new APIGatewayClient({ region: AWS_REGION });

/**
 * Parameters for API Gateway creation
 */
export interface ApiGatewayConfig {
  bucketName: string;
  tableName: string;
  dynamodbRoleArn: string;
  s3RoleArn: string;
}

/**
 * API Gateway deployment result
 */
export interface ApiGatewayResult {
  apiId: string;
  apiUrl: string;
  region: string;
  stageName: string;
}

/**
 * Main function to create and configure the complete API Gateway
 */
export async function createApiGateway(config: ApiGatewayConfig): Promise<ApiGatewayResult> {
  console.log('📡 Creating API Gateway for Maritime Surveillance...\n');

  try {
    // Step 1: Create REST API
    const apiId = await createRestApi();
    
    // Step 2: Get root resource
    const rootResourceId = await getRootResource(apiId);
    
    // Step 3: Create resource structure
    const resources = await createResourceStructure(apiId, rootResourceId);
    
    // Step 4: Configure endpoints
    await configureGetShipsEndpoint(apiId, resources.ships, config.tableName, config.dynamodbRoleArn);
    await configureGetShipProfileEndpoint(apiId, resources.profileKey, config.tableName, config.dynamodbRoleArn);
    await configureGetShipPhotoEndpoint(apiId, resources.photoKey, config.bucketName, config.s3RoleArn);
    
    // Step 5: Enable CORS on all resources
    await enableCORS(apiId, [resources.ships, resources.profileKey, resources.photoKey]);
    
    // Step 5.5: Add CORS headers to Gateway Responses (for API Gateway errors)
    await addGatewayResponseCORS(apiId);
    
    // Step 6: Deploy API
    const apiUrl = await deployApi(apiId);
    
    console.log('\n✅ API Gateway successfully created and deployed!');
    console.log(`📍 API URL: ${apiUrl}\n`);

    return {
      apiId,
      apiUrl,
      region: AWS_REGION,
      stageName: STAGE_NAME,
    };
  } catch (error) {
    console.error('❌ Error creating API Gateway:', error);
    throw error;
  }
}

/**
 * Create the REST API
 */
async function createRestApi(): Promise<string> {
  console.log('📦 Creating REST API...');

  const response = await apiGatewayClient.send(
    new CreateRestApiCommand({
      name: API_NAME,
      description: 'API Gateway for maritime surveillance - Ship tracking and monitoring',
      binaryMediaTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/*',
      ],
      endpointConfiguration: {
        types: ['REGIONAL'],
      },
    })
  );

  const apiId = response.id!;
  console.log(`   ✓ API created with ID: ${apiId}`);
  console.log(`   ✓ Binary media types configured for images`);
  
  return apiId;
}

/**
 * Get the root resource ID
 */
async function getRootResource(apiId: string): Promise<string> {
  const response = await apiGatewayClient.send(
    new GetResourcesCommand({ restApiId: apiId })
  );

  const rootResource = response.items?.find((r) => r.path === '/');
  
  if (!rootResource?.id) {
    throw new Error('Root resource not found');
  }

  return rootResource.id;
}

/**
 * Create the complete resource structure
 * 
 * Structure:
 * /
 * └── /ships
 *     ├── /photo
 *     │   └── /{key}
 *     └── /profile
 *         └── /{key}
 */
async function createResourceStructure(apiId: string, rootResourceId: string) {
  console.log('🌳 Creating resource structure...');

  // Create /ships
  const shipsResponse = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: rootResourceId,
      pathPart: 'ships',
    })
  );
  const shipsResourceId = shipsResponse.id!;
  console.log('   ✓ Created /ships');

  // Create /ships/photo
  const photoResponse = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: shipsResourceId,
      pathPart: 'photo',
    })
  );
  const photoResourceId = photoResponse.id!;
  console.log('   ✓ Created /ships/photo');

  // Create /ships/photo/{key}
  const photoKeyResponse = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: photoResourceId,
      pathPart: '{key}',
    })
  );
  const photoKeyResourceId = photoKeyResponse.id!;
  console.log('   ✓ Created /ships/photo/{key}');

  // Create /ships/profile
  const profileResponse = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: shipsResourceId,
      pathPart: 'profile',
    })
  );
  const profileResourceId = profileResponse.id!;
  console.log('   ✓ Created /ships/profile');

  // Create /ships/profile/{key}
  const profileKeyResponse = await apiGatewayClient.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: profileResourceId,
      pathPart: '{key}',
    })
  );
  const profileKeyResourceId = profileKeyResponse.id!;
  console.log('   ✓ Created /ships/profile/{key}');

  return {
    ships: shipsResourceId,
    photo: photoResourceId,
    photoKey: photoKeyResourceId,
    profile: profileResourceId,
    profileKey: profileKeyResourceId,
  };
}

/**
 * Configure GET /ships endpoint
 * Returns list of all ships from DynamoDB (Scan operation)
 */
async function configureGetShipsEndpoint(
  apiId: string,
  resourceId: string,
  tableName: string,
  roleArn: string
) {
  console.log('🔧 Configuring GET /ships...');

  // Create GET method
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
    })
  );

  // Configure DynamoDB integration (Scan)
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${AWS_REGION}:dynamodb:action/Scan`,
      credentials: roleArn,
      passthroughBehavior: 'NEVER',
      requestParameters: {
        'integration.request.header.Content-Type': "'application/x-amz-json-1.0'",
      },
      requestTemplates: {
        'application/json': `{"TableName": "${tableName}"}`,
      },
    })
  );

  // Method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Integration response with VTL transformation - 200 (Default)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': `#set($inputRoot = $input.path('$'))
{
  "ships": [
    #foreach($item in $inputRoot.Items)
    {
      "id": "$item.id.S",
      "nom": "$item.nom.S",
      "type": "$item.type.S",
      "pavillon": "$item.pavillon.S",
      "taille": $item.taille.N,
      "nombre_marins": $item.nombre_marins.N,
      "s3_image_key": "$item.s3_image_key.S"
    }#if($foreach.hasNext),#end
    #end
  ]
}`,
      },
    })
  );

  // Integration response - 500 (Catches backend errors)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '500',
      selectionPattern: '(\\n|.)*(Exception|Error|Failed|Unauthorized)(\\n|.)*',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': '{"error": "Internal server error"}',
      },
    })
  );

  console.log('   ✓ GET /ships configured with DynamoDB Scan');
}

/**
 * Configure GET /ships/profile/{key} endpoint
 * Returns a specific ship profile from DynamoDB (GetItem operation)
 */
async function configureGetShipProfileEndpoint(
  apiId: string,
  resourceId: string,
  tableName: string,
  roleArn: string
) {
  console.log('🔧 Configuring GET /ships/profile/{key}...');

  // Create GET method with path parameter
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  // Configure DynamoDB integration (GetItem)
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${AWS_REGION}:dynamodb:action/GetItem`,
      credentials: roleArn,
      requestTemplates: {
        'application/json': `{
  "TableName": "${tableName}",
  "Key": {
    "id": {
      "S": "$input.params('key')"
    }
  }
}`,
      },
    })
  );

  // Method response - 200 (Success)
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Method response - 404 (Not Found)
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '404',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Method response - 500 (Server Error)
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '500',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Integration response - 500 (Catches DynamoDB errors - must come FIRST)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '500',
      selectionPattern: '.*(__type|Exception|Error).*',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': '{"error": "Internal server error", "message": "$input.path(\'$.message\')"}',
      },
    })
  );

  // Integration response - 404 (Item not found)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '404',
      selectionPattern: '.*"Item"\\s*:\\s*\\{\\s*\\}.*',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': '{"error": "Ship not found"}',
      },
    })
  );

  // Integration response - 200 (Default - successful responses with items)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': `#set($inputRoot = $input.path('$'))
#if($inputRoot.Item && !$inputRoot.Item.isEmpty())
{
  "id": "$inputRoot.Item.id.S",
  "nom": "$inputRoot.Item.nom.S",
  "type": "$inputRoot.Item.type.S",
  "pavillon": "$inputRoot.Item.pavillon.S",
  "taille": $inputRoot.Item.taille.N,
  "nombre_marins": $inputRoot.Item.nombre_marins.N,
  "s3_image_key": "$inputRoot.Item.s3_image_key.S"
}
#else
{
  "error": "Ship not found"
}
#end`,
      },
    })
  );

  console.log('   ✓ GET /ships/profile/{key} configured with DynamoDB GetItem');
}

/**
 * Configure GET /ships/photo/{key} endpoint
 * Returns a ship photo from S3 (GetObject operation)
 */
async function configureGetShipPhotoEndpoint(
  apiId: string,
  resourceId: string,
  bucketName: string,
  roleArn: string
) {
  console.log('🔧 Configuring GET /ships/photo/{key}...');

  // Create GET method with path parameter
  await apiGatewayClient.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      authorizationType: 'NONE',
      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  // Configure S3 integration (GetObject)
  await apiGatewayClient.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      type: 'AWS',
      integrationHttpMethod: 'GET',
      uri: `arn:aws:apigateway:${AWS_REGION}:s3:path/${bucketName}/{key}`,
      credentials: roleArn,
      requestParameters: {
        'integration.request.path.key': 'method.request.path.key',
      },
      contentHandling: 'CONVERT_TO_BINARY',
    })
  );

  // Method response
  await apiGatewayClient.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Integration response - 200 (Default)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': 'integration.response.header.Content-Type',
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
    })
  );

  // Integration response - 404 (Catches S3 errors)
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '404',
      selectionPattern: '(\\n|.)*(NoSuchKey|NotFound|AccessDenied)(\\n|.)*',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': '{"error": "Photo not found"}',
      },
    })
  );

  console.log('   ✓ GET /ships/photo/{key} configured with S3 GetObject');
}

/**
 * Enable CORS on all resources
 * Adds OPTIONS method to handle preflight requests
 */
async function enableCORS(apiId: string, resourceIds: string[]) {
  console.log('🔐 Enabling CORS...');

  for (const resourceId of resourceIds) {
    // Create OPTIONS method
    await apiGatewayClient.send(
      new PutMethodCommand({
        restApiId: apiId,
        resourceId: resourceId,
        httpMethod: 'OPTIONS',
        authorizationType: 'NONE',
      })
    );

    // Mock integration for OPTIONS
    await apiGatewayClient.send(
      new PutIntegrationCommand({
        restApiId: apiId,
        resourceId: resourceId,
        httpMethod: 'OPTIONS',
        type: 'MOCK',
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
      })
    );

    // Method response for OPTIONS
    await apiGatewayClient.send(
      new PutMethodResponseCommand({
        restApiId: apiId,
        resourceId: resourceId,
        httpMethod: 'OPTIONS',
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      })
    );

    // Integration response for OPTIONS
    await apiGatewayClient.send(
      new PutIntegrationResponseCommand({
        restApiId: apiId,
        resourceId: resourceId,
        httpMethod: 'OPTIONS',
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers':
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      })
    );
  }

  console.log('   ✓ CORS enabled on all endpoints');
}

/**
 * Add CORS headers to Gateway Responses
 * This fixes CORS issues for API Gateway's own error responses (4xx, 5xx)
 */
async function addGatewayResponseCORS(apiId: string) {
  console.log('🔐 Adding CORS headers to Gateway Responses...');

  const responseTypes = ['DEFAULT_4XX', 'DEFAULT_5XX'];

  for (const responseType of responseTypes) {
    await apiGatewayClient.send(
      new PutGatewayResponseCommand({
        restApiId: apiId,
        responseType: responseType as any,
        responseParameters: {
          'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
          'gatewayresponse.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'gatewayresponse.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
        },
      })
    );
  }

  console.log('   ✓ Gateway Response CORS headers added');
}

/**
 * Deploy API to a stage
 */
async function deployApi(apiId: string): Promise<string> {
  console.log(`🚀 Deploying API to stage: ${STAGE_NAME}...`);

  await apiGatewayClient.send(
    new CreateDeploymentCommand({
      restApiId: apiId,
      stageName: STAGE_NAME,
      description: 'Production deployment for Maritime Surveillance API',
    })
  );

  const apiUrl = `https://${apiId}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE_NAME}`;
  console.log(`   ✓ API deployed successfully`);

  return apiUrl;
}

/**
 * Delete API Gateway (for cleanup)
 */
export async function deleteApiGateway(apiId: string): Promise<void> {
  console.log(`🗑️  Deleting API Gateway: ${apiId}...`);

  try {
    await apiGatewayClient.send(
      new DeleteRestApiCommand({
        restApiId: apiId,
      })
    );

    console.log('   ✓ API Gateway deleted successfully');
  } catch (error) {
    console.error('   ✗ Error deleting API Gateway:', error);
    throw error;
  }
}
