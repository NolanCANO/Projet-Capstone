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
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
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
  apiKey: string;
}

/**
 * Main function to create and configure the complete API Gateway
 * 
 * Cette fonction orchestre la création complète de l'API Gateway pour le système de surveillance maritime
 * 
 * Séquence d'exécution (ORDRE CRITIQUE):
 * 1. createRestApi() - Créer l'API REST avec support binaire pour les images
 * 2. getRootResource() - Récupérer l'ID de la ressource racine /
 * 3. createResourceStructure() - Créer l'arborescence des ressources (/ships, /ships/photo/{key}, /ships/profile/{key})
 * 4. configureGet*Endpoint() - Configurer chaque endpoint avec:
 *    - Method (GET + API Key required)
 *    - Integration (DynamoDB Scan/GetItem ou S3 GetObject)
 *    - Method Response (status codes + headers)
 *    - Integration Response (transformations VTL + gestion erreurs)
 * 5. enableCORS() - Ajouter OPTIONS method sur chaque ressource (preflight)
 * 6. addGatewayResponseCORS() - Ajouter headers CORS sur les erreurs API Gateway
 * 7. deployApi() - Déployer sur le stage "prod"
 * 8. createApiKeyAndUsagePlan() - Créer clé API + limites throttling/quota
 * 
 * @param config - Configuration (bucket S3, table DynamoDB, IAM roles)
 * @returns Résultat du déploiement (URL API + clé API)
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
    
    // Step 7: Create API Key and Usage Plan
    const apiKey = await createApiKeyAndUsagePlan(apiId, STAGE_NAME);
    
    console.log('\n✅ API Gateway successfully created and deployed!');
    console.log(`📍 API URL: ${apiUrl}`);
    console.log(`🔑 API Key: ${apiKey}\n`);

    return {
      apiId,
      apiUrl,
      region: AWS_REGION,
      stageName: STAGE_NAME,
      apiKey,
    };
  } catch (error) {
    console.error('❌ Error creating API Gateway:', error);
    throw error;
  }
}

/**
 * Create the REST API
 * Configure l'API Gateway avec support pour les contenus binaires (images)
 * 
 * Configuration critique:
 * - binaryMediaTypes: Déclare les types MIME traités comme binaires
 *   Sans cela, API Gateway tenterait d'encoder les images en base64
 *   ce qui corromprait les données JPEG/PNG
 * - endpointConfiguration: REGIONAL (évite les coûts CloudFront)
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
 * Structure de l'API (3 endpoints REST):
 * /
 * └── /ships                    → GET liste tous les navires (DynamoDB Scan)
 *     ├── /photo
 *     │   └── /{key}            → GET photo d'un navire (S3 GetObject)
 *     └── /profile
 *         └── /{key}            → GET profil d'un navire (DynamoDB GetItem)
 * 
 * Hiérarchie des ressources:
 * - Chaque ressource a un ID unique
 * - Les ressources enfants référencent le parentId
 * - Les path parameters utilisent la notation {key}
 */
async function createResourceStructure(apiId: string, rootResourceId: string) {
  console.log('🌳 Creating resource structure...');

  // Create /ships (ressource parente pour tous les endpoints navires)
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
      apiKeyRequired: true,
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
  // VTL (Velocity Template Language) transforme la réponse DynamoDB en JSON simple
  // Format DynamoDB: {"Items": [{"id": {"S": "B-001"}, "nom": {"S": "..."}}]}
  // Format cible: {"ships": [{"id": "B-001", "nom": "..."}]}
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
      authorizationType: 'NONE',      apiKeyRequired: true,      requestParameters: {
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
  // Le selectionPattern DOIT être défini AVANT la réponse 200 par défaut
  // Pattern regex qui détecte les erreurs DynamoDB dans la réponse
  // Exemples: ValidationException, ResourceNotFoundException, etc.
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
  // Détecte quand DynamoDB retourne un objet Item vide {}
  // Ceci se produit quand la clé n'existe pas dans la table
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
  // C'est la réponse par défaut (pas de selectionPattern)
  // VTL transforme le format DynamoDB en JSON simple
  // Vérifie que Item existe ET n'est pas vide avant de transformer
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
      authorizationType: 'NONE',      apiKeyRequired: true,      requestParameters: {
        'method.request.path.key': true,
      },
    })
  );

  // Configure S3 integration (GetObject)
  // Cette intégration proxy les requêtes vers S3 GetObject
  // contentHandling: CONVERT_TO_BINARY est ESSENTIEL pour les images
  // Sans cela, API Gateway corrompt les données binaires JPEG/PNG
  // Le paramètre {key} est mappé depuis le path parameter de la requête
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
      passthroughBehavior: 'WHEN_NO_MATCH',
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
        'method.response.header.Content-Length': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    })
  );

  // Integration response - 200 (Default)
  // Passe les headers S3 (Content-Type, Content-Length) au client
  // Ceci préserve le type MIME original de l'image (image/jpeg, image/png)
  // Le corps de la réponse contient les bytes bruts de l'image
  await apiGatewayClient.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: 'GET',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Content-Type': 'integration.response.header.Content-Type',
        'method.response.header.Content-Length': 'integration.response.header.Content-Length',
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
    })
  );

  // Integration response - 404 (Catches S3 errors)
  // Détecte les erreurs S3: NoSuchKey (fichier introuvable), AccessDenied
  // Pattern regex couvre plusieurs types d'erreurs S3
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
 * Create API Key and Usage Plan
 * Sécurise tous les endpoints avec une clé API et définit des limites d'utilisation
 * 
 * Fonctionnement:
 * 1. Création d'une API Key unique (timestamp pour éviter les doublons)
 * 2. Création d'un Usage Plan avec throttling et quota
 * 3. Association de l'API Key au Usage Plan
 * 
 * Limites configurées:
 * - Rate limit: 100 req/s (empêche les abus)
 * - Burst limit: 200 req simultanées (gère les pics de trafic)
 * - Quota: 10,000 req/jour (protège contre la surutilisation)
 * 
 * @param apiId - ID de l'API REST Gateway
 * @param stageName - Stage de déploiement (prod, dev, etc.)
 * @returns La valeur de la clé API (à transmettre aux clients)
 */
async function createApiKeyAndUsagePlan(apiId: string, stageName: string): Promise<string> {
  console.log('🔑 Creating API Key and Usage Plan...');

  // Create API Key
  // Le timestamp garantit l'unicité du nom même en cas de re-déploiement
  const apiKeyResponse = await apiGatewayClient.send(
    new CreateApiKeyCommand({
      name: `maritime-api-key-${Date.now()}`,
      description: 'API key for Maritime Surveillance System',
      enabled: true,
    })
  );

  const apiKeyId = apiKeyResponse.id!;
  const apiKeyValue = apiKeyResponse.value!;
  console.log(`   ✓ API Key created: ${apiKeyId}`);

  // Create Usage Plan
  // Throttle: Limite la vitesse de consommation (évite le DDoS)
  // Quota: Limite la consommation totale sur une période (contrôle les coûts)
  const usagePlanResponse = await apiGatewayClient.send(
    new CreateUsagePlanCommand({
      name: `maritime-usage-plan-${Date.now()}`,
      description: 'Usage plan for Maritime Surveillance API',
      apiStages: [
        {
          apiId: apiId,
          stage: stageName,
        },
      ],
      throttle: {
        rateLimit: 100,  // requests per second
        burstLimit: 200, // maximum concurrent requests
      },
      quota: {
        limit: 10000,    // 10,000 requests
        period: 'DAY',   // per day
      },
    })
  );

  const usagePlanId = usagePlanResponse.id!;
  console.log(`   ✓ Usage Plan created: ${usagePlanId}`);

  // Associate API Key with Usage Plan
  // Sans cette association, la clé API ne serait pas valide
  await apiGatewayClient.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId: usagePlanId,
      keyId: apiKeyId,
      keyType: 'API_KEY',
    })
  );

  console.log('   ✓ API Key associated with Usage Plan');

  return apiKeyValue;
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
