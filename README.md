# 🚢 Projet Capstone - Surveillance de Transbordement Maritime

## 📋 Vue d'ensemble

Système de surveillance automatique des échanges illégaux en mer entre deux navires. Ce projet combine IoT (simulation Raspberry Pi), infrastructure AWS et interface web pour la détection et visualisation en temps réel des activités maritimes.

## 🎯 Mission

Détecter automatiquement les échanges illégaux en mer, entre deux navires, en utilisant :
- **IoT** : Raspberry Pi pour simuler le comportement d'un bateau
- **Infrastructure** : Collecte et traitement des données via AWS (S3, DynamoDB, API Gateway)
- **Interface** : Visualisation en temps réel sur page web connectée via API

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Web App   │────▶│   API Gateway    │────▶│  DynamoDB   │
│ (Checker)   │     │   (REST API)     │     │  (Profiles) │
└─────────────┘     └──────────────────┘     └─────────────┘
                             │
                             ▼
                       ┌──────────┐
                       │    S3    │
                       │ (Photos) │
                       └──────────┘
```

### Services AWS utilisés

| Service | Usage | Points |
|---------|-------|--------|
| **S3** | Stockage des photos de bateaux | 2+1 |
| **DynamoDB** | Base de données des profils de navires | 1+3+2+4 |
| **API Gateway** | Exposition REST API avec CORS | 5 |
| **IAM** | Gestion des permissions et rôles | - |

## 📡 API Endpoints

### 1. GET /ships/photo/{key}
Retourne la photo de profil du bateau depuis S3
- **Paramètre** : `key` - Identifiant unique de la photo (ex: `pecheur-b-001.jpg`)
- **Réponse** : Image binaire
- **Intégration** : S3 via IAM Role `APIGatewayS3ServiceRole`

### 2. GET /ships/profile/{key}
Retourne les données du profil du bateau depuis DynamoDB
- **Paramètre** : `key` - Identifiant unique du bateau (ex: `B-001`)
- **Réponse** : JSON avec les informations du bateau
- **Intégration** : DynamoDB via IAM Role `APIGatewayDynamoDBServiceRole`

### 3. GET /ships
Retourne la liste de tous les bateaux depuis DynamoDB
- **Réponse** : Array JSON avec tous les bateaux
- **Intégration** : DynamoDB via IAM Role `APIGatewayDynamoDBServiceRole`

## 📊 Structure de Données DynamoDB

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

### Attributs de la table
- **id** (String, Partition Key) : Identifiant unique du bateau
- **nom** (String) : Nom du navire
- **type** (String) : Type de navire (Pêcheur, Tanker, Cargo, etc.)
- **pavillon** (String) : Pays de registration
- **taille** (Number) : Longueur en mètres
- **nombre_marins** (Number) : Équipage à bord
- **s3_image_key** (String) : Clé de l'image dans S3

## 🚀 Installation et Configuration

### Prérequis

- Node.js (v18+)
- TypeScript
- AWS CLI configuré avec le profil `aws-labs`
- Session AWS SSO active
- Accès aux rôles IAM :
  - `APIGatewayDynamoDBServiceRole`
  - `APIGatewayS3ServiceRole`

### Installation

```bash
cd labs/05-projet-capstone-one
npm install
```

### Récupération des ARN des rôles IAM

```bash
# Rôle pour DynamoDB
aws iam get-role --role-name APIGatewayDynamoDBServiceRole --query 'Role.Arn' --output text --profile aws-labs

# Rôle pour S3
aws iam get-role --role-name APIGatewayS3ServiceRole --query 'Role.Arn' --output text --profile aws-labs
```

## 📦 Déploiement

### Déployer le projet (Idempotent)

```bash
npx ts-node src/deploy-project.ts
```

**Ce script doit** :
1. ✅ Créer le bucket S3 avec nommage unique
2. ✅ Uploader les images depuis `./assets/`
3. ✅ Créer la table DynamoDB avec partition key `id`
4. ✅ Insérer les données depuis `./data/ships.json`
5. ✅ Créer l'API Gateway REST API
6. ✅ Configurer CORS pour tous les endpoints
7. ✅ Créer les 3 endpoints avec intégrations AWS
8. ✅ Déployer l'API sur un stage (ex: `prod`)

### Détruire toutes les ressources

```bash
npx ts-node src/destroy-project.ts
```

**Ce script doit** :
1. ✅ Supprimer tous les items de DynamoDB
2. ✅ Supprimer la table DynamoDB
3. ✅ Vider le bucket S3 (supprimer tous les objets)
4. ✅ Supprimer le bucket S3
5. ✅ Supprimer l'API Gateway et ses stages

## 🧪 Tests

### Test avec l'interface web

1. Ouvrez `checker/index.html` avec Live Server (VS Code)
2. Entrez l'URL de votre API Gateway
3. Testez les 3 endpoints :
   - Liste des bateaux
   - Profil d'un bateau
   - Photo d'un bateau

### Test manuel avec curl

```bash
# Liste des bateaux
curl https://[API-ID].execute-api.[REGION].amazonaws.com/prod/ships

# Profil d'un bateau
curl https://[API-ID].execute-api.[REGION].amazonaws.com/prod/ships/profile/B-001

# Photo d'un bateau
curl https://[API-ID].execute-api.[REGION].amazonaws.com/prod/ships/photo/pecheur-b-001.jpg
```

## 📁 Structure du Projet

```
labs/05-projet-capstone-one/
├── assets/                    # Images des bateaux
│   ├── pecheur-b-001.jpg
│   ├── tanker-b-002.jpg
│   └── ...
├── checker/                   # Interface web de test
│   └── index.html
├── data/                      # Données à importer
│   └── ships.json
├── diagrams/                  # Diagrammes d'architecture
│   └── target-architecture.png
├── src/
│   ├── deploy-project.ts     # Script de déploiement
│   └── destroy-project.ts    # Script de destruction
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 📝 Grille de Notation (sur 20 points)

| Critère | Points | Description |
|---------|--------|-------------|
| **Création et Remplissage du Bucket S3** | 2 | Bucket créé avec toutes les images uploadées |
| **Création de la Table DynamoDB** | 1 | Table créée avec partition key correcte |
| **Insertion des Items dans DynamoDB** | 3 | Tous les bateaux insérés depuis ships.json |
| **Suppression d'un Item dans DynamoDB** | 2 | Fonction pour supprimer un item |
| **Fonction de suppression complète** | 2 | Script destroy-project.ts fonctionnel |
| **Qualité du code** | 5 | Diagramme, commentaires, clarté, logs |
| **API Gateway - Intégration S3** | 1 | GET /ships/photo/{key} fonctionnel |
| **API Gateway - Intégration DynamoDB** | 4 | GET /ships/profile/{key} et GET /ships |
| **TOTAL** | **20** | |

## ✅ Checklist de Livraison

- [ ] Code TypeScript avec AWS SDK v3
- [ ] CORS configuré sur tous les endpoints
- [ ] `npx ts-node src/deploy-project.ts` fonctionne (idempotent)
- [ ] `npx ts-node src/destroy-project.ts` fonctionne
- [ ] `checker/index.html` fonctionne avec Live Server
- [ ] Logs détaillés dans la console
- [ ] Commentaires clairs dans le code
- [ ] Gestion d'erreurs robuste
- [ ] Diagramme d'architecture à jour
- [ ] Nommage des ressources cohérent

## 🛠️ Technologies Utilisées

- **TypeScript** : Langage principal
- **AWS SDK v3** : `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/client-apigateway`
- **Node.js** : Runtime
- **ts-node** : Exécution TypeScript

## 🔒 Bonnes Pratiques Sécurité

- ✅ Utilisation de rôles IAM au lieu de credentials hardcodés
- ✅ CORS configuré spécifiquement (pas de wildcard en production)
- ✅ Validation des entrées utilisateur
- ✅ Gestion appropriée des erreurs sans exposer de détails sensibles
- ✅ Bucket S3 avec permissions minimales

## 🐛 Troubleshooting

### Erreur CORS
- Vérifiez que CORS est activé sur API Gateway
- Assurez-vous que les headers `Access-Control-Allow-Origin` sont configurés

### Erreur IAM
- Vérifiez que les rôles IAM existent
- Confirmez que les ARN sont corrects dans la configuration

### Erreur 403 Forbidden
- Vérifiez les permissions des rôles IAM
- Assurez-vous que le nom du bucket/table est correct

### Timeout
- Augmentez le timeout d'API Gateway si nécessaire
- Vérifiez la connectivité réseau

## 📚 Ressources

- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
- [S3 Developer Guide](https://docs.aws.amazon.com/s3/)

## 👥 Auteur

Projet réalisé dans le cadre du cours Cloud Computing - Ynov

## 📄 Licence

MIT
