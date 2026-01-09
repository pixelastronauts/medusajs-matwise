import { loadEnv, Modules, defineConfig } from '@medusajs/utils';
import {
  ADMIN_CORS,
  AUTH_CORS,
  BACKEND_URL,
  COOKIE_SECRET,
  DATABASE_URL,
  JWT_SECRET,
  REDIS_URL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SHOULD_DISABLE_ADMIN,
  STORE_CORS,
  MOLLIE_API_KEY,
  MOLLIE_REDIRECT_URL,
  MEDUSA_URL,
  WORKER_MODE,
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_BUCKET,
  MEILISEARCH_HOST,
  MEILISEARCH_ADMIN_KEY,
  IS_DEV
} from 'lib/constants';

loadEnv(process.env.NODE_ENV, process.cwd());

const medusaConfig = {
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseLogging: false,
    redisUrl: REDIS_URL,
    workerMode: WORKER_MODE,
    http: {
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      storeCors: STORE_CORS,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET
    }
  },
  admin: {
    backendUrl: BACKEND_URL,
    disable: SHOULD_DISABLE_ADMIN,
    path: "/app",
    vite: () => ({
      plugins: [
        {
          name: 'html-transform',
          transformIndexHtml(html) {
            return html.replace(/<title>.*?<\/title>/, '<title>Matwise Admin</title>')
          }
        }
      ]
    }),
  },
  modules: [
    {
      resolve: './src/modules/sanity',
      options: {
        api_token: process.env.SANITY_API_TOKEN,
        project_id: process.env.SANITY_PROJECT_ID || 'x8b8f8al',
        api_version: new Date().toISOString().split('T')[0],
        dataset: process.env.SANITY_DATASET || (IS_DEV ? 'staging' : 'production'),
        studio_url: process.env.SANITY_STUDIO_URL || 'http://localhost:3000',
        type_map: {
          product: 'product',
          collection: 'collection',
        },
      },
    },
    {
      resolve: './src/modules/pricing-formula'
    },
    {
      resolve: './src/modules/company'
    },
    {
      resolve: './src/modules/invoice-generator'
    },
    {
      resolve: './src/modules/volume-pricing'
    },
    {
      resolve: './src/modules/vat_validation'
    },
    {
      key: Modules.TAX,
      resolve: '@medusajs/medusa/tax',
      options: {
        providers: [
          {
            resolve: './src/modules/vat_tax_provider',
            id: 'vat_tax_provider',
            options: {
              home_country: 'NL',
              default_tax_rate: 21,
              debug: false,
            },
          },
        ],
      },
    },
    {
      key: Modules.FILE,
      resolve: '@medusajs/file',
      options: {
        providers: [
          ...(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY ? [{
            resolve: './src/modules/minio-file',
            id: 'minio',
            options: {
              endPoint: MINIO_ENDPOINT,
              accessKey: MINIO_ACCESS_KEY,
              secretKey: MINIO_SECRET_KEY,
              bucket: MINIO_BUCKET // Optional, default: medusa-media
            }
          }] : [{
            resolve: '@medusajs/file-local',
            id: 'local',
            options: {
              upload_dir: 'static',
              backend_url: `${BACKEND_URL}/static`
            }
          }])
        ]
      }
    },
    ...(REDIS_URL ? [{
      key: Modules.EVENT_BUS,
      resolve: '@medusajs/event-bus-redis',
      options: {
        redisUrl: REDIS_URL
      }
    },
    {
      key: Modules.WORKFLOW_ENGINE,
      resolve: '@medusajs/workflow-engine-redis',
      options: {
        redis: {
          url: REDIS_URL,
        }
      }
    }] : []),
    {
      key: Modules.NOTIFICATION,
      resolve: '@medusajs/notification',
      options: {
        providers: [
          // Local provider for development (logs to console)
          ...(!SENDGRID_API_KEY && !RESEND_API_KEY ? [{
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              channels: ['email'],
            }
          }] : []),
          // SendGrid provider
          ...(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL ? [{
            resolve: '@medusajs/notification-sendgrid',
            id: 'sendgrid',
            options: {
              channels: ['email'],
              api_key: SENDGRID_API_KEY,
              from: SENDGRID_FROM_EMAIL,
            }
          }] : []),
          // Resend provider
          ...(RESEND_API_KEY && RESEND_FROM_EMAIL ? [{
            resolve: './src/modules/email-notifications',
            id: 'resend',
            options: {
              channels: ['email'],
              api_key: RESEND_API_KEY,
              from: RESEND_FROM_EMAIL,
            },
          }] : []),
        ]
      }
    },
    ...(MOLLIE_API_KEY ? [{
      key: Modules.PAYMENT,
      resolve: '@medusajs/payment',
      options: {
        providers: [
          {
            resolve: '@variablevic/mollie-payments-medusa/providers/mollie',
            id: 'mollie',
            options: {
              apiKey: MOLLIE_API_KEY,
              redirectUrl: MOLLIE_REDIRECT_URL,
              medusaUrl: MEDUSA_URL,
              autoCapture: true,
              debug: false,
            },
          },
        ],
      },
    }] : [])
  ],
  plugins: [
    ...(MEILISEARCH_HOST && MEILISEARCH_ADMIN_KEY ? [{
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: MEILISEARCH_HOST,
          apiKey: MEILISEARCH_ADMIN_KEY
        },
        settings: {
          products: {
            type: 'products',
            enabled: true,
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
            primaryKey: 'id',
          }
        }
      }
    }] : [])
  ]
};

export default defineConfig(medusaConfig);
