/**
 * Split items into the given number of chunks of about the same size
 * ex. splitIntoChunks([1, 2, 3, 4, 5], 2) => [[1, 2, 3], [4, 5]]
 */
export default function splitIntoChunks<T>(items: T[], count: number): T[][] {
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );
}
