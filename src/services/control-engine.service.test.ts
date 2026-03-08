import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ControlEngineService } from './control-engine.service';
import type { AnomalySeverity } from '../ml/detect-anomaly';

function createFakePrisma() {
  const enforcementWrites: Array<Record<string, unknown>> = [];

  const prisma = {
    fallbackConfig: {
      upsert: async () => null,
      findUnique: async () => ({
        primaryService: 'openai',
        fallbackService: 'anthropic',
        enabled: true
      })
    },
    modelDowngradeMapping: {
      upsert: async () => null,
      findUnique: async ({
        where
      }: {
        where: { service_sourceModel: { service: string; sourceModel: string } };
      }) => {
        const key = `${where.service_sourceModel.service}:${where.service_sourceModel.sourceModel}`;
        if (key === 'openai:gpt-4') {
          return {
            service: 'openai',
            sourceModel: 'gpt-4',
            targetModel: 'gpt-3.5-turbo'
          };
        }
        return null;
      }
    },
    enforcementLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        enforcementWrites.push(data);
        return data;
      },
      findMany: async () => enforcementWrites
    }
  };

  return { prisma, enforcementWrites };
}

function createUsageSignal(severity: AnomalySeverity) {
  return () => ({
    isAnomaly: severity !== 'NONE',
    severity,
    threshold: 10,
    multiplier: severity === 'HIGH' ? 2 : severity === 'MEDIUM' ? 1.5 : 1
  });
}

describe('ControlEngineService', () => {
  it('reroutes overload traffic only when rerouteEligible is true', async () => {
    const { prisma } = createFakePrisma();
    const engine = new ControlEngineService({
      prisma: prisma as any,
      detectUsage: createUsageSignal('HIGH')
    });

    const rerouted = await engine.evaluate({
      service: 'openai',
      endpoint: '/v1/chat/completions',
      method: 'POST',
      currentUsage: 20,
      requestBody: { model: 'gpt-4' },
      availableServices: ['openai', 'anthropic', 'stripe'],
      rerouteEligible: true
    });

    assert.equal(rerouted.reason, 'OVERLOAD');
    assert.ok(rerouted.actions.includes('REROUTE'));
    assert.ok(rerouted.actions.includes('DOWNGRADE'));
    assert.equal(rerouted.routedService, 'anthropic');
    assert.equal((rerouted.modifiedBody as { model: string }).model, 'gpt-3.5-turbo');

    const notRerouted = await engine.evaluate({
      service: 'openai',
      endpoint: '/v1/chat/completions',
      method: 'POST',
      currentUsage: 20,
      requestBody: { model: 'gpt-4' },
      availableServices: ['openai', 'anthropic', 'stripe'],
      rerouteEligible: false
    });

    assert.ok(!notRerouted.actions.includes('REROUTE'));
    assert.equal(notRerouted.routedService, 'openai');
  });

  it('blocks explicit security policy signals without rerouting', async () => {
    const { prisma, enforcementWrites } = createFakePrisma();
    const engine = new ControlEngineService({
      prisma: prisma as any,
      detectUsage: createUsageSignal('NONE')
    });

    const decision = await engine.evaluate({
      service: 'openai',
      endpoint: '/v1/chat/completions',
      method: 'POST',
      currentUsage: 1,
      requestBody: { model: 'gpt-4' },
      availableServices: ['openai', 'anthropic', 'stripe'],
      rerouteEligible: true,
      policySignal: {
        block: true,
        details: 'suspicious key reuse detected'
      }
    });

    assert.equal(decision.reason, 'SECURITY_POLICY');
    assert.deepEqual(decision.actions, ['BLOCK']);
    assert.equal(decision.routedService, 'openai');
    assert.equal(enforcementWrites[0]?.reason, 'SECURITY_POLICY');
    assert.match(String(enforcementWrites[0]?.details), /suspicious key reuse detected/);
  });
});
