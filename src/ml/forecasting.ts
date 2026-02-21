export function trainUsageModel(data: number[]) {

  const avg =
    data.reduce((a,b)=>a+b,0) / data.length;

  const variance =
    data.reduce((sum,x)=>sum+(x-avg)**2,0) / data.length;

  const stdDev = Math.sqrt(variance);

  const threshold = avg + 3 * stdDev;

  return {
    averageRequestsPerMinute: avg,
    stdDev,
    threshold
  };
}
