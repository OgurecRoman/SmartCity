import swaggerJsdoc from 'swagger-jsdoc';

// const options: swaggerJsdoc.Options = {
//   definition: {
//     openapi: '3.0.0',
//     info: {
//       title: 'SmartCity API',
//       version: '1.0.0',
//       description: 'API для системы управления заявками жителей',
//     },
//     servers: [
//       {
//         url: 'http://localhost:3000',
//         description: 'Локальный сервер',
//       },
//     ],
//     components: {
//       securitySchemes: {
//         MaxInitData: {
//           type: 'apiKey',
//           in: 'header',
//           name: 'Authorization',
//           description: 'Telegram Web App initData (формат: "MaxInitData <initData>")',
//         },
//         DevUser: {
//           type: 'apiKey',
//           in: 'header',
//           name: 'X-Dev-User-Id',
//           description: 'Тестовый ID пользователя (только для разработки)',
//         },
//       },
//       schemas: {
//         Error: {
//           type: 'object',
//           properties: {
//             error: {
//               type: 'object',
//               properties: {
//                 message: { type: 'string' },
//                 code: { type: 'string' },
//               },
//             },
//           },
//         },
//         Me: {
//           type: 'object',
//           properties: {
//             role: { type: 'string', enum: ['RESIDENT', 'UK_EMPLOYEE'] },
//             onboarded: { type: 'boolean' },
//             apartment: { type: 'string', nullable: true },
//             entrance: { type: 'string', nullable: true },
//             residentTypeLabel: { type: 'string' },
//             house: { $ref: '#/components/schemas/House' },
//           },
//         },
//         House: {
//           type: 'object',
//           properties: {
//             id: { type: 'number' },
//             address: { type: 'string' },
//             apartmentsCount: { type: 'number', nullable: true },
//             lat: { type: 'number', nullable: true },
//             lng: { type: 'number', nullable: true },
//           },
//         },
//         RequestItem: {
//           type: 'object',
//           properties: {
//             id: { type: 'number' },
//             title: { type: 'string' },
//             status: { type: 'string', enum: ['VOTING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] },
//             statusLabel: { type: 'string' },
//             isMine: { type: 'boolean' },
//             canVote: { type: 'boolean' },
//             votesCount: { type: 'number' },
//             votesRequired: { type: 'number' },
//             author: {
//               type: 'object',
//               properties: {
//                 name: { type: 'string' },
//                 apartment: { type: 'string', nullable: true },
//               },
//             },
//           },
//         },
//       },
//     },
//   },
//   apis: ['./src/routes/*.ts'],
// };

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SmartCity API',
      version: '1.0.0',
      description: 'API для системы управления заявками жителей',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Локальный сервер' },
      { url: 'https://your-vercel-app.vercel.app', description: 'Production' },
    ],
    // ... остальное
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);