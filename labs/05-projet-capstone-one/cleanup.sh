#!/bin/bash

# Script de nettoyage pour le projet final
# TODO: Adaptez ce script selon vos ressources créées

echo "🧹 Nettoyage des ressources AWS pour le projet final..."

# TODO: Définissez vos variables (remplacez par vos valeurs)
REGION="eu-west-1"
PROFILE="aws-labs"

# TODO: Récupérez le nom de votre table DynamoDB
# Format attendu: documents-[votre-nom]-[timestamp]
TABLE_NAME_PATTERN="documents-*"

# TODO: Récupérez le nom de votre bucket S3
# Format attendu: documents-storage-[votre-nom]-[timestamp]
BUCKET_NAME_PATTERN="documents-storage-*"

echo "Région: $REGION"
echo "Profil: $PROFILE"

# TODO: Fonction pour supprimer les tables DynamoDB
cleanup_dynamodb() {
    echo "🗄️ Nettoyage des tables DynamoDB..."
    
    # TODO: Listez vos tables DynamoDB
    # aws dynamodb list-tables --region $REGION --profile $PROFILE --query "TableNames[?starts_with(@, 'documents-')]" --output text
    
    # TODO: Pour chaque table trouvée, supprimez-la
    # aws dynamodb delete-table --table-name $TABLE_NAME --region $REGION --profile $PROFILE
    
    echo "TODO: Implémenter le nettoyage DynamoDB"
}

# TODO: Fonction pour supprimer les buckets S3
cleanup_s3() {
    echo "🪣 Nettoyage des buckets S3..."
    
    # TODO: Listez vos buckets S3
    # aws s3api list-buckets --profile $PROFILE --query "Buckets[?starts_with(Name, 'documents-storage-')].Name" --output text
    
    # TODO: Pour chaque bucket trouvé:
    # 1. Supprimez tous les objets
    # aws s3 rm s3://$BUCKET_NAME --recursive --profile $PROFILE
    
    # 2. Supprimez toutes les versions (si versioning activé)
    # aws s3api delete-objects --bucket $BUCKET_NAME --delete "$(aws s3api list-object-versions --bucket $BUCKET_NAME --profile $PROFILE --output json --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')" --profile $PROFILE
    
    # 3. Supprimez le bucket
    # aws s3api delete-bucket --bucket $BUCKET_NAME --region $REGION --profile $PROFILE
    
    echo "TODO: Implémenter le nettoyage S3"
}

# TODO: Fonction pour supprimer les APIs Gateway
cleanup_api_gateway() {
    echo "🌐 Nettoyage des APIs Gateway..."
    
    # TODO: Listez vos APIs
    # aws apigateway get-rest-apis --region $REGION --profile $PROFILE --query "items[?name=='documents-api'].id" --output text
    
    # TODO: Pour chaque API trouvée, supprimez-la
    # aws apigateway delete-rest-api --rest-api-id $API_ID --region $REGION --profile $PROFILE
    
    echo "TODO: Implémenter le nettoyage API Gateway"
}

# TODO: Fonction pour vérifier les permissions
check_permissions() {
    echo "🔐 Vérification des permissions..."
    
    # TODO: Vérifiez que le profil AWS est configuré
    if ! aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
        echo "❌ Erreur: Profil AWS '$PROFILE' non configuré ou session expirée"
        echo "Exécutez: aws sso login --profile $PROFILE"
        exit 1
    fi
    
    echo "✅ Permissions vérifiées"
}

# TODO: Fonction principale
main() {
    echo "Démarrage du nettoyage..."
    
    # TODO: Vérifiez les permissions
    check_permissions
    
    # TODO: Demandez confirmation
    read -p "⚠️  Êtes-vous sûr de vouloir supprimer toutes les ressources ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Nettoyage annulé"
        exit 0
    fi
    
    # TODO: Exécutez le nettoyage
    cleanup_s3
    cleanup_dynamodb
    cleanup_api_gateway
    
    echo "✅ Nettoyage terminé !"
    echo "💡 Vérifiez la console AWS pour confirmer la suppression des ressources"
}

# TODO: Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Affiche cette aide"
    echo "  --dry-run      Affiche les ressources qui seraient supprimées sans les supprimer"
    echo "  --force        Supprime sans demander confirmation"
    echo ""
    echo "Exemples:"
    echo "  $0                 # Nettoyage interactif"
    echo "  $0 --dry-run       # Voir ce qui serait supprimé"
    echo "  $0 --force         # Suppression automatique"
}

# TODO: Fonction dry-run
dry_run() {
    echo "🔍 Mode dry-run - Affichage des ressources qui seraient supprimées:"
    
    # TODO: Listez les ressources sans les supprimer
    echo "Tables DynamoDB:"
    # aws dynamodb list-tables --region $REGION --profile $PROFILE --query "TableNames[?starts_with(@, 'documents-')]" --output table
    
    echo "Buckets S3:"
    # aws s3api list-buckets --profile $PROFILE --query "Buckets[?starts_with(Name, 'documents-storage-')]" --output table
    
    echo "APIs Gateway:"
    # aws apigateway get-rest-apis --region $REGION --profile $PROFILE --query "items[?name=='documents-api']" --output table
    
    echo "TODO: Implémenter le mode dry-run"
}

# TODO: Gestion des arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --dry-run)
        dry_run
        exit 0
        ;;
    --force)
        FORCE=true
        main
        ;;
    "")
        main
        ;;
    *)
        echo "Option inconnue: $1"
        show_help
        exit 1
        ;;
esac