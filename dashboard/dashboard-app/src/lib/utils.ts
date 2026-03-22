export function normalizeDishName(name: string): string {
  if (!name) return name;
  let normalized = name;
  
  // Replace "w/" (case insensitive, bounded) with "With "
  normalized = normalized.replace(/\bw\//gi, 'With ');
  
  // Remove "(GF)" or "GF" usually formatted as "(GF)"
  normalized = normalized.replace(/\s*\(GF\)/gi, '');
  
  // Remove extra spaces if any were left behind
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Example capitalization fix if 'with' was lowercased somewhere
  normalized = normalized.replace(/\bwith\b/gi, 'With');
  
  return normalized;
}
