import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function testS3() {
  console.log('🚀 Прямой тест Beget S3...\n');

  const s3Client = new S3Client({
    region: 'ru-1',
    endpoint: 'https://s3.ru1.storage.beget.cloud',
    credentials: {
      accessKeyId: 'RQ1DBLURGB3CZBZZ53UH',
      secretAccessKey: 'tEd6d37G3jmUIGtHR7WXzzxOghfZlMBoiPFrPMpt',
    },
    forcePathStyle: true,
  });

  const testImage = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64'
  );

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: '58b38eef4985-smartcity',
        Key: 'simple-test.jpg',
        Body: testImage,
        ContentType: 'image/jpeg',
      })
    );
    console.log('✅ УСПЕХ! Файл загружен.');
    console.log('Ссылка: https://58b38eef4985-smartcity.s3.ru1.storage.beget.cloud/simple-test.jpg');
  } catch (error: any) {
    console.error('❌ Ошибка:', error.name);
    console.error('Детали:', error.message);
  }
}

testS3();
