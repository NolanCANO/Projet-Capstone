# Architecture - Système de Surveillance Maritime

## Diagramme d'Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Client (Web Browser)                         │
│                     127.0.0.1:5500/checker/index.html                │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ HTTPS + API Key (x-api-key header)
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API Gateway (REST API)                          │
│                   maritime-surveillance-api                          │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  Endpoints:                                                      │ │
│ │  • GET /ships                    ──┐                             │ │
│ │  • GET /ships/profile/{key}      ──┼── API Key Required          │ │
│ │  • GET /ships/photo/{key}        ──┘                             │ │
│ │  • OPTIONS /* (CORS Preflight)                                   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└────┬─────────────────────────────────────────────┬───────────────────┘
     │                                             │
     │ IAM Role:                                   │ IAM Role:
     │ APIGatewayDynamoDBServiceRole               │ APIGatewayS3ServiceRole
     │ (Scan, GetItem)                             │ (GetObject)
     │                                             │
     ▼                                             ▼
┌─────────────────────────────┐      ┌──────────────────────────────┐
│         DynamoDB            │      │            S3                │
│    maritime-ships (table)   │      │  maritime-ships-photos-*     │
│                             │      │                              │
│ • id (HASH key)             │      │ • pecheur-b-001.jpg          │
│ • nom                       │      │ • tanker-b-002.jpg           │
│ • type                      │      │                              │
│ • pavillon                  │      │ Content-Type: image/jpeg     │
│ • taille                    │      │ Binary (CONVERT_TO_BINARY)   │
│ • nombre_marins             │      │                              │
│ • s3_image_key ───────────────────▶│                              │
└─────────────────────────────┘      └──────────────────────────────┘
```

### Légende
- **Flèches pleines (──▶)**: Flux de données principales
- **IAM Roles**: Permissions assumées par API Gateway pour accéder aux services AWS
- **API Key**: Sécurité au niveau application (header `x-api-key`)
- **CORS**: Gestion des requêtes cross-origin (OPTIONS method)
## Flux des Requêtes

### 1. GET /ships - Liste tous les bateaux
```
Client → API Gateway → IAM Role (DynamoDB) → DynamoDB (Scan) → Response JSON
```

**Opération DynamoDB:** `Scan` sur la table `maritime-ships`

**Transformation VTL:** Conversion du format DynamoDB vers JSON simplifié

**Response:**
```json
{
  "ships": [
    {
      "id": "B-001",
      "nom": "Le Vigilant",
      "type": "Pêcheur",
      "pavillon": "France",
      "taille": 12.5,
      "nombre_marins": 4,
      "s3_image_key": "pecheur-b-001.jpg"
    }
  ]
}
```

### 2. GET /ships/profile/{key} - Profil d'un bateau
```
Client → API Gateway → IAM Role (DynamoDB) → DynamoDB (GetItem) → Response JSON
```

**Opération DynamoDB:** `GetItem` avec clé de partition `id`

**Paramètre:** `{key}` = ID du bateau (ex: "B-001")

**Transformation VTL:** Extraction de l'item et conversion en JSON

**Response:**
```json
{
  "id": "B-001",
  "nom": "Le Vigilant",
  "type": "Pêcheur",
  "pavillon": "France",
  "taille": 12.5,
  "nombre_marins": 4,
  "s3_image_key": "pecheur-b-001.jpg"
}
```

### 3. GET /ships/photo/{key} - Photo d'un bateau
```
Client → API Gateway → IAM Role (S3) → S3 (GetObject) → Response Binary (JPEG)
```

**Opération S3:** `GetObject` sur le bucket

**Paramètre:** `{key}` = Nom du fichier (ex: "pecheur-b-001.jpg")

**Content-Type:** `image/jpeg`

**Gestion Binaire:** `CONVERT_TO_BINARY` sur API Gateway

## Sécurité

### Authentification
- **API Key** requise sur tous les endpoints GET
- Rate limiting: 100 req/s
- Quota: 10,000 req/jour

### Autorisations IAM

#### APIGatewayDynamoDBServiceRole
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Scan",
    "dynamodb:GetItem"
  ],
  "Resource": "arn:aws:dynamodb:eu-west-1:*:table/maritime-ships"
}
```

#### APIGatewayS3ServiceRole
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject"
  ],
  "Resource": "arn:aws:s3:::maritime-ships-photos-*/*"
}
```

### CORS
- **Headers autorisés:** `Content-Type, X-Amz-Date, Authorization, X-Api-Key`
- **Méthodes autorisées:** `GET, OPTIONS`
- **Origin:** `*` (pour développement)

## Mapping des Fichiers

Le système utilise un mapping intelligent pour gérer les différences entre noms de fichiers locaux et clés S3 :

```typescript
// Fichiers locaux → Clés S3 dans DynamoDB
fisher.jpg → pecheur-b-001.jpg
tanker.jpg → tanker-b-002.jpg
```

**Raison:** Faciliter la gestion et permettre des conventions de nommage différentes entre développement et production.

## Déploiement

### Ordre de création
1. **S3 Bucket** + Upload des images
2. **DynamoDB Table** + Insertion des données
3. **API Gateway** + Configuration CORS + Endpoints
4. **API Key** + Usage Plan

### Commandes
```bash
# Déploiement complet
npm run deploy

# Destruction complète
npm run destroy
```

## Ressources Créées

| Service | Nom | Description |
|---------|-----|-------------|
| S3 | `maritime-ships-photos-{timestamp}` | Stockage des images |
| DynamoDB | `maritime-ships` | Table des métadonnées |
| API Gateway | `maritime-surveillance-api` | API REST |
| API Key | `maritime-api-key-{timestamp}` | Clé d'authentification |

## Performances

- **Latence estimée:** < 200ms par requête
- **Coût estimé:** ~$0.01/jour (usage faible)
- **Scalabilité:** Automatique via AWS Serverless
