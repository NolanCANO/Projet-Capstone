/**
 * S3 Bucket Management Module
 * 
 * This module handles S3 bucket creation, file uploads, and cleanup
 * for the Maritime Surveillance System.
 * 
 * Functions:
 * - createBucket: Create S3 bucket for ship photos
 * - uploadShipPhotos: Upload images from assets folder
 * - deleteBucket: Delete bucket and all objects
 */

import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Configuration
const AWS_REGION = process.env['AWS_REGION'] || 'eu-west-1';

// Initialize S3 client
const s3Client = new S3Client({ region: AWS_REGION });

/**
 * S3 Bucket configuration
 */
export interface S3BucketConfig {
  bucketName: string;
  assetsPath?: string;
}

/**
 * S3 Bucket result
 */
export interface S3BucketResult {
  bucketName: string;
  region: string;
  uploadedFiles: string[];
}

/**
 * Create S3 bucket for ship photos
 */
export async function createS3Bucket(config: S3BucketConfig): Promise<S3BucketResult> {
  console.log('📦 Creating S3 Bucket for Ship Photos...\n');

  const { bucketName, assetsPath = './assets' } = config;

  try {
    // Check if bucket already exists
    const bucketExists = await checkBucketExists(bucketName);

    if (bucketExists) {
      console.log(`   ℹ️  Bucket '${bucketName}' already exists, skipping creation`);
    } else {
      // Create bucket
      await createBucket(bucketName);
    }

    // Configure CORS
    await configureBucketCORS(bucketName);

    // Upload ship photos
    const uploadedFiles = await uploadShipPhotos(bucketName, assetsPath);

    console.log('\n✅ S3 Bucket successfully configured!');
    console.log(`📍 Bucket: s3://${bucketName}\n`);

    return {
      bucketName,
      region: AWS_REGION,
      uploadedFiles,
    };
  } catch (error) {
    console.error('❌ Error creating S3 bucket:', error);
    throw error;
  }
}

/**
 * Check if bucket exists
 */
async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Create S3 bucket
 */
async function createBucket(bucketName: string): Promise<void> {
  console.log(`🔧 Creating bucket: ${bucketName}...`);

  try {
    // For eu-west-1, we need to specify LocationConstraint
    if (AWS_REGION === 'us-east-1') {
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        })
      );
    } else {
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: AWS_REGION as any,
          },
        })
      );
    }

    console.log(`   ✓ Bucket created successfully`);
  } catch (error: any) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`   ℹ️  Bucket already exists and owned by you`);
    } else {
      throw error;
    }
  }
}

/**
 * Configure CORS for bucket
 */
async function configureBucketCORS(bucketName: string): Promise<void> {
  console.log('🔐 Configuring CORS...');

  await s3Client.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })
  );

  console.log('   ✓ CORS configured');
}

/**
 * Upload ship photos from assets folder
 */
async function uploadShipPhotos(bucketName: string, assetsPath: string): Promise<string[]> {
  console.log(`📤 Uploading ship photos from ${assetsPath}...`);

  const uploadedFiles: string[] = [];

  try {
    // Read all files from assets directory
    const files = readdirSync(assetsPath);
    const imageFiles = files.filter((file) => {
      const ext = file.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.gif');
    });

    if (imageFiles.length === 0) {
      console.log('   ⚠️  No image files found in assets folder');
      return uploadedFiles;
    }

    console.log(`   Found ${imageFiles.length} image(s) to upload`);

    // Upload each image
    for (const fileName of imageFiles) {
      const filePath = join(assetsPath, fileName);
      
      // Check if it's a file
      const stats = statSync(filePath);
      if (!stats.isFile()) {
        continue;
      }

      // Read file content
      const fileContent = readFileSync(filePath);

      // Determine content type
      const contentType = getContentType(fileName);

      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: fileContent,
          ContentType: contentType,
        })
      );

      uploadedFiles.push(fileName);
      console.log(`   ✓ Uploaded: ${fileName} (${(fileContent.length / 1024).toFixed(2)} KB)`);
    }

    return uploadedFiles;
  } catch (error) {
    console.error('   ✗ Error uploading files:', error);
    throw error;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Delete S3 bucket and all objects (cleanup)
 */
export async function deleteS3Bucket(bucketName: string): Promise<void> {
  console.log(`🗑️  Deleting S3 Bucket: ${bucketName}...`);

  try {
    // Check if bucket exists
    const exists = await checkBucketExists(bucketName);
    
    if (!exists) {
      console.log('   ℹ️  Bucket does not exist, skipping deletion');
      return;
    }

    // List and delete all objects first
    console.log('   Deleting all objects...');
    let continuationToken: string | undefined;
    let totalDeleted = 0;

    do {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
        })
      );

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key!,
            })
          );
          totalDeleted++;
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    if (totalDeleted > 0) {
      console.log(`   ✓ Deleted ${totalDeleted} object(s)`);
    } else {
      console.log('   ℹ️  Bucket was empty');
    }

    // Delete the bucket
    await s3Client.send(
      new DeleteBucketCommand({
        Bucket: bucketName,
      })
    );

    console.log('   ✓ Bucket deleted successfully');
  } catch (error: any) {
    if (error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
      console.log('   ℹ️  Bucket does not exist');
    } else {
      console.error('   ✗ Error deleting bucket:', error);
      throw error;
    }
  }
}
