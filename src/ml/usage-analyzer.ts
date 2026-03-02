export function groupByMinute(metrics: any[]) {

  const buckets: Record<string, number> = {};

  metrics.forEach(metric => {

    const minute =
      new Date(metric.timestamp)
        .toISOString()
        .slice(0,16);

    buckets[minute] =
      (buckets[minute] || 0) + 1;
  });

  return Object.values(buckets);
}