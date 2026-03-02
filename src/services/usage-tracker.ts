const usageMap: Record<string, number> = {};

export function recordRequest(service: string) {

  const minute =
    new Date().toISOString().slice(0,16);

  const key = `${service}-${minute}`;

  usageMap[key] =
    (usageMap[key] || 0) + 1;

  return usageMap[key];
}
