export function forecastNextHours(data: number[], hours = 24) {

  if (data.length === 0) {
    return Array(hours).fill(0);
  }

  // simple moving average model
  const window = Math.min(5, data.length);

  const avg =
    data.slice(-window)
        .reduce((a, b) => a + b, 0) / window;

  const predictions: number[] = [];

  for (let i = 0; i < hours; i++) {
    predictions.push(avg);
  }

  return predictions;
}