export interface RetrainStatus {
  status: 'trained' | 'partial' | 'skipped';
  message: string;
}

export function buildRetrainStatus(
  usageModelTrained: boolean,
  responseAnomalyModelTrained: boolean
): RetrainStatus {
  if (usageModelTrained && responseAnomalyModelTrained) {
    return {
      status: 'trained',
      message: 'Usage and response anomaly models retrained successfully.'
    };
  }

  if (usageModelTrained) {
    return {
      status: 'partial',
      message: 'Usage model retrained, but the response anomaly model was skipped because there was not enough data.'
    };
  }

  if (responseAnomalyModelTrained) {
    return {
      status: 'partial',
      message: 'Response anomaly model retrained, but the usage model was skipped because there was not enough data.'
    };
  }

  return {
    status: 'skipped',
    message: 'No models were retrained because there was not enough data.'
  };
}
