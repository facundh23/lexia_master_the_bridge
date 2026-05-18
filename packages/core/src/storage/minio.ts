import { Client as MinioClient } from 'minio';

export interface MinioConfig {
  endPoint?: string;
  port?: number;
  useSSL?: boolean;
  accessKey?: string;
  secretKey?: string;
}

export function createMinioClient(config?: MinioConfig): MinioClient {
  return new MinioClient({
    endPoint: config?.endPoint ?? process.env.MINIO_ENDPOINT ?? 'localhost',
    port: config?.port ?? Number(process.env.MINIO_PORT ?? '9000'),
    useSSL: config?.useSSL ?? false,
    accessKey: config?.accessKey ?? process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: config?.secretKey ?? process.env.MINIO_SECRET_KEY ?? '',
  });
}

export async function ensureBucket(client: MinioClient, bucket: string): Promise<void> {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}
