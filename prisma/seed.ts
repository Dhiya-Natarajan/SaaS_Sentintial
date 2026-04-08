// /**
//  * prisma/seed.ts
//  *
//  * Populates all SaaS-Sentinel tables with realistic dummy data.
//  *
//  * Run with:
//  *   npx ts-node prisma/seed.ts
//  *   OR: bun prisma/seed.ts
//  *   OR: add to package.json prisma.seed and run: npx prisma db seed
//  */

// import { PrismaClient } from '@prisma/client';
// import process from 'process';

// const prisma = new PrismaClient();

// // ─── Helpers ───────────────────────────────────────────────────────────────

// function randomBetween(min: number, max: number) {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// function randomFloat(min: number, max: number, decimals = 4) {
//   return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
// }

// function randomChoice<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// /** Return a Date somewhere between `daysAgo` days ago and now */
// function randomDate(daysAgo: number): Date {
//   const now = Date.now();
//   const earliest = now - daysAgo * 24 * 60 * 60 * 1000;
//   return new Date(earliest + Math.random() * (now - earliest));
// }

// // ─── Constants ─────────────────────────────────────────────────────────────

// const SERVICES = ['openai', 'anthropic', 'stripe'] as const;
// type Service = typeof SERVICES[number];

// const ENDPOINTS: Record<Service, string[]> = {
//   openai:    ['/v1/chat/completions', '/v1/embeddings', '/v1/models', '/v1/images/generations'],
//   anthropic: ['/v1/messages', '/v1/models'],
//   stripe:    ['/v1/charges', '/v1/customers', '/v1/invoices', '/v1/payment_intents'],
// };

// const METHODS: Record<Service, string[]> = {
//   openai:    ['POST', 'GET'],
//   anthropic: ['POST', 'GET'],
//   stripe:    ['GET', 'POST'],
// };

// // Realistic latency ranges per service (ms)
// const LATENCY: Record<Service, [number, number]> = {
//   openai:    [400, 2200],
//   anthropic: [350, 2000],
//   stripe:    [80,  400],
// };

// // Cost per request ranges (USD)
// const COST: Record<Service, [number, number]> = {
//   openai:    [0.0002, 0.08],
//   anthropic: [0.0003, 0.06],
//   stripe:    [0,      0],
// };

// const STATUS_CODES = {
//   normal:  [200, 200, 200, 200, 200, 200, 200, 200, 201, 200], // mostly 200s
//   anomaly: [429, 500, 503, 400, 403, 502],
// };

// // ─── 1. ApiMetric ──────────────────────────────────────────────────────────

// async function seedApiMetrics() {
//   console.log('📊  Seeding ApiMetric (300 records across 30 days)...');

//   const records = [];

//   for (let i = 0; i < 300; i++) {
//     const service  = randomChoice(SERVICES);
//     const endpoint = randomChoice(ENDPOINTS[service]);
//     const method   = randomChoice(METHODS[service]);
//     const isAnomaly = i % 15 === 0; // every 15th record is anomalous

//     const latencyMs  = isAnomaly
//       ? randomBetween(4000, 12000)           // anomalous: very slow
//       : randomBetween(...LATENCY[service]);  // normal range

//     const statusCode = isAnomaly
//       ? randomChoice(STATUS_CODES.anomaly)
//       : randomChoice(STATUS_CODES.normal);

//     const cost = randomFloat(...COST[service]);

//     records.push({
//       timestamp:    randomDate(30),
//       service,
//       endpoint,
//       method,
//       statusCode,
//       latencyMs,
//       cost,
//       requestSize:  randomBetween(200, 8000),
//       responseSize: randomBetween(500, 24000),
//       actionTaken:  isAnomaly
//         ? randomChoice(['THROTTLE', 'REROUTE', 'BLOCK', null])
//         : null,
//     });
//   }

//   // Sort by timestamp so the dashboard timeline looks natural
//   records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

//   await prisma.apiMetric.createMany({ data: records });
//   console.log(`   ✓ ${records.length} ApiMetric records inserted`);
// }

// // ─── 2. ServiceCredential ──────────────────────────────────────────────────

// async function seedServiceCredentials() {
//   console.log('🔑  Seeding ServiceCredential...');

//   const credentials = [
//     {
//       service:       'openai',
//       environment:   'development',
//       secretRef:     'secrets/openai/dev/api-key',
//       version:       'v3',
//       active:        true,
//       lastRotatedAt: randomDate(7),
//     },
//     {
//       service:       'openai',
//       environment:   'production',
//       secretRef:     'secrets/openai/prod/api-key',
//       version:       'v5',
//       active:        true,
//       lastRotatedAt: randomDate(2),
//     },
//     {
//       service:       'anthropic',
//       environment:   'development',
//       secretRef:     'secrets/anthropic/dev/api-key',
//       version:       'v2',
//       active:        true,
//       lastRotatedAt: randomDate(14),
//     },
//     {
//       service:       'anthropic',
//       environment:   'production',
//       secretRef:     'secrets/anthropic/prod/api-key',
//       version:       'v4',
//       active:        true,
//       lastRotatedAt: randomDate(3),
//     },
//     {
//       service:       'stripe',
//       environment:   'development',
//       secretRef:     'secrets/stripe/dev/secret-key',
//       version:       'v1',
//       active:        true,
//       lastRotatedAt: randomDate(30),
//     },
//     {
//       service:       'stripe',
//       environment:   'production',
//       secretRef:     'secrets/stripe/prod/secret-key',
//       version:       'v2',
//       active:        true,
//       lastRotatedAt: randomDate(10),
//     },
//   ];

//   for (const cred of credentials) {
//     await prisma.serviceCredential.upsert({
//       where:  { service_environment: { service: cred.service, environment: cred.environment } },
//       update: cred,
//       create: cred,
//     });
//   }

//   console.log(`   ✓ ${credentials.length} ServiceCredential records inserted`);
// }

// // ─── 3. PricingRule ────────────────────────────────────────────────────────

// async function seedPricingRules() {
//   console.log('💰  Seeding PricingRule...');

//   const rules = [
//     // OpenAI
//     {
//       code:            'OPENAI_CHAT_GPT4O',
//       service:         'openai',
//       method:          'POST',
//       endpointPattern: '/v1/chat/completions',
//       model:           'gpt-4o',
//       billingUnit:     'REQUEST',
//       flatRate:        0.005,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     {
//       code:            'OPENAI_CHAT_GPT4O_MINI',
//       service:         'openai',
//       method:          'POST',
//       endpointPattern: '/v1/chat/completions',
//       model:           'gpt-4o-mini',
//       billingUnit:     'REQUEST',
//       flatRate:        0.0002,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     {
//       code:            'OPENAI_EMBEDDINGS',
//       service:         'openai',
//       method:          'POST',
//       endpointPattern: '/v1/embeddings',
//       model:           null,
//       billingUnit:     'REQUEST',
//       flatRate:        0.00002,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     {
//       code:            'OPENAI_IMAGE_GEN',
//       service:         'openai',
//       method:          'POST',
//       endpointPattern: '/v1/images/generations',
//       model:           null,
//       billingUnit:     'REQUEST',
//       flatRate:        0.04,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     // Anthropic
//     {
//       code:            'ANTHROPIC_CLAUDE_HAIKU',
//       service:         'anthropic',
//       method:          'POST',
//       endpointPattern: '/v1/messages',
//       model:           'claude-3-haiku-20240307',
//       billingUnit:     'REQUEST',
//       flatRate:        0.00025,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     {
//       code:            'ANTHROPIC_CLAUDE_SONNET',
//       service:         'anthropic',
//       method:          'POST',
//       endpointPattern: '/v1/messages',
//       model:           'claude-sonnet-4-6',
//       billingUnit:     'REQUEST',
//       flatRate:        0.003,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//     // Stripe
//     {
//       code:            'STRIPE_CHARGE',
//       service:         'stripe',
//       method:          'POST',
//       endpointPattern: '/v1/charges',
//       model:           null,
//       billingUnit:     'REQUEST',
//       flatRate:        0.0,
//       currency:        'USD',
//       active:          true,
//       effectiveFrom:   new Date('2024-01-01'),
//     },
//   ];

//   for (const rule of rules) {
//     await prisma.pricingRule.upsert({
//       where:  { code: rule.code },
//       update: rule,
//       create: rule,
//     });
//   }

//   console.log(`   ✓ ${rules.length} PricingRule records inserted`);
// }

// // ─── 4. FallbackConfig ─────────────────────────────────────────────────────

// async function seedFallbackConfigs() {
//   console.log('🔀  Seeding FallbackConfig...');

//   const configs = [
//     { primaryService: 'openai',    fallbackService: 'anthropic', enabled: true },
//     { primaryService: 'anthropic', fallbackService: 'openai',    enabled: true },
//     { primaryService: 'stripe',    fallbackService: 'stripe',    enabled: false },
//   ];

//   for (const config of configs) {
//     await prisma.fallbackConfig.upsert({
//       where:  { primaryService: config.primaryService },
//       update: config,
//       create: config,
//     });
//   }

//   console.log(`   ✓ ${configs.length} FallbackConfig records inserted`);
// }

// // ─── 5. ModelDowngradeMapping ──────────────────────────────────────────────

// async function seedModelDowngradeMappings() {
//   console.log('⬇️   Seeding ModelDowngradeMapping...');

//   const mappings = [
//     // OpenAI downgrades
//     { service: 'openai', sourceModel: 'gpt-4o',            targetModel: 'gpt-4o-mini' },
//     { service: 'openai', sourceModel: 'gpt-4',             targetModel: 'gpt-4o-mini' },
//     { service: 'openai', sourceModel: 'gpt-4-turbo',       targetModel: 'gpt-4o-mini' },
//     { service: 'openai', sourceModel: 'gpt-3.5-turbo',     targetModel: 'gpt-4o-mini' },
//     // Anthropic downgrades
//     { service: 'anthropic', sourceModel: 'claude-opus-4-6',   targetModel: 'claude-3-haiku-20240307' },
//     { service: 'anthropic', sourceModel: 'claude-sonnet-4-6', targetModel: 'claude-3-haiku-20240307' },
//   ];

//   for (const mapping of mappings) {
//     await prisma.modelDowngradeMapping.upsert({
//       where:  { service_sourceModel: { service: mapping.service, sourceModel: mapping.sourceModel } },
//       update: mapping,
//       create: mapping,
//     });
//   }

//   console.log(`   ✓ ${mappings.length} ModelDowngradeMapping records inserted`);
// }

// // ─── 6. EnforcementLog ─────────────────────────────────────────────────────

// async function seedEnforcementLogs() {
//   console.log('🚨  Seeding EnforcementLog (60 records)...');

//   const reasons   = ['ANOMALY_DETECTED', 'RATE_LIMIT_EXCEEDED', 'COST_THRESHOLD', 'POLICY_VIOLATION', 'NONE'];
//   const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NONE'];
//   const actions   = ['THROTTLE', 'REROUTE', 'BLOCK', 'DOWNGRADE', 'ALERT', 'NONE'];

//   const records = [];

//   for (let i = 0; i < 60; i++) {
//     const service      = randomChoice(SERVICES);
//     const isSerious    = i % 5 === 0;
//     const reason       = isSerious ? randomChoice(reasons.slice(0, 4)) : 'NONE';
//     const severity     = isSerious ? randomChoice(severities.slice(0, 4)) : 'NONE';
//     const action       = isSerious ? randomChoice(actions.slice(0, 5)) : 'NONE';

//     records.push({
//       timestamp:         randomDate(30),
//       service,
//       routedService:     action === 'REROUTE'
//         ? randomChoice(SERVICES.filter(s => s !== service))
//         : service,
//       endpoint:          randomChoice(ENDPOINTS[service]),
//       method:            randomChoice(METHODS[service]),
//       reason,
//       severity,
//       action,
//       throttleMs:        action === 'THROTTLE' ? randomBetween(500, 5000) : 0,
//       currentUsage:      randomBetween(10, 500),
//       anomalyThreshold:  randomFloat(0.5, 0.95, 2),
//       anomalyMultiplier: randomFloat(1.2, 3.5, 2),
//       details:           isSerious
//         ? `Automated ${action.toLowerCase()} triggered: ${reason.replace(/_/g, ' ').toLowerCase()}`
//         : null,
//     });
//   }

//   records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

//   await prisma.enforcementLog.createMany({ data: records });
//   console.log(`   ✓ ${records.length} EnforcementLog records inserted`);
// }

// // ─── Main ──────────────────────────────────────────────────────────────────

// async function main() {
//   console.log('\n🌱  SaaS-Sentinel database seed starting...\n');

//   await seedApiMetrics();
//   await seedServiceCredentials();
//   await seedPricingRules();
//   await seedFallbackConfigs();
//   await seedModelDowngradeMappings();
//   await seedEnforcementLogs();

//   console.log('\n✅  All tables seeded successfully!');
//   console.log('   Run `npx prisma studio` to browse the data.\n');
// }

// main()
//   .catch((e) => {
//     console.error('❌  Seed failed:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });