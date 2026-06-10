import 'dotenv/config';
// external imports
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
// import express from 'express';
// internal imports
import { AppModule } from './app.module';
import appConfig from './config/app.config';
import { CustomExceptionFilter } from './common/exception/custom-exception.filter';
import { NajimStorage } from './common/lib/Disk/NajimStorage';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Handle raw body for webhooks
  // app.use('/payment/stripe/webhook', express.raw({ type: 'application/json' }));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: '*',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP to ensure Swagger UI assets load
    }),
  );
  // Enable it, if special charactrers not encoding perfectly
  // app.use((req, res, next) => {
  //   // Only force content-type for specific API routes, not Swagger or assets
  //   if (req.path.startsWith('/api') && !req.path.startsWith('/api/docs')) {
  //     res.setHeader('Content-Type', 'application/json; charset=utf-8');
  //   }
  //   next();
  // });
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false,
    prefix: '/public',
  });
  app.useStaticAssets(join(__dirname, '..', 'public/storage'), {
    index: false,
    prefix: '/storage',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.useGlobalFilters(new CustomExceptionFilter());

  // storage setup
  NajimStorage.config({
    driver: 's3',
    connection: {
      rootUrl: appConfig().storageUrl.rootUrl,
      publicUrl: appConfig().storageUrl.rootUrlPublic,
      // aws s3
      awsBucket: appConfig().fileSystems.s3.bucket,
      awsAccessKeyId: appConfig().fileSystems.s3.key,
      awsSecretAccessKey: appConfig().fileSystems.s3.secret,
      awsDefaultRegion: appConfig().fileSystems.s3.region,
      awsEndpoint: appConfig().fileSystems.s3.endpoint,
      minio: true,
      // google cloud storage
      gcpProjectId: appConfig().fileSystems.gcs.projectId,
      gcpKeyFile: appConfig().fileSystems.gcs.keyFile,
      gcpApiEndpoint: appConfig().fileSystems.gcs.apiEndpoint,
      gcpBucket: appConfig().fileSystems.gcs.bucket,
    },
  });

  // Swagger setup
  const options = new DocumentBuilder()
    .setTitle(`${appConfig().app.name} API`)
    .setDescription(`${appConfig().app.name} API Docs`)
    .setVersion('1.0')
    .addTag(`${appConfig().app.name}`)
    // .addBearerAuth(
    //   { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    //   'bearer', // Generic token for endpoints with @ApiBearerAuth()
    // )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'user_token',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'admin_token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: `${appConfig().app.name?.toUpperCase()} API`,
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
      displayRequestDuration: true,

      // 1. Persistence Logic: Reload holeo jeno authorize thake
      onComplete: () => {
        setTimeout(() => {
          const ui = window['ui'];
          if (ui) {
            const persistedAuth = JSON.parse(
              localStorage.getItem('authorized') || '{}',
            );
            if (Object.keys(persistedAuth).length > 0) {
              ui.authActions.authorize(persistedAuth);
            }
          }
        }, 100);
      },

      // 2. Interceptor: Login hole auto-set hobe
      responseInterceptor: (response) => {
        if (
          response.url &&
          response.url.includes('/auth/login') &&
          (response.status === 200 || response.status === 201)
        ) {
          try {
            const body = response.body || response.obj || response.data;
            const data =
              typeof body === 'string'
                ? JSON.parse(body)
                : body;

            const token = data?.authorization?.access_token;
            // Handle both response structures safely
            const userType = data?.user?.type || data?.type;

            if (token) {
              const key = userType === 'admin' ? 'admin_token' : 'user_token';

              const authObj = {
                // Set the specific token (user_token or admin_token)
                [key]: {
                  name: key,
                  schema: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                  },
                  value: token,
                },
              };

              const ui = window['ui'];
              if (ui) {
                ui.authActions.authorize(authObj);
                localStorage.setItem('authorized', JSON.stringify(authObj));
                console.log(
                  `✅ Auto-authorized via login interceptor (${key})`,
                );
              }
            }
          } catch (err) {
            console.warn('Swagger Interceptor:', err);
          }
        }
        return response;
      },
    },
  });

  // end swagger

  await app.listen(process.env.PORT ?? 4000, '0.0.0.0', () => {
    console.log(`Application is running on port: ${process.env.PORT}`);
  });
}
bootstrap();
