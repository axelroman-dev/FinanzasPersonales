/** Sin mayúsculas ni acentos: "cafe" encuentra "Café" */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Sugerencias de descripción para lo que se lleva escrito. `known` viene
 * ordenada de la más usada a la menos; primero van las que empiezan con el
 * texto, luego las que lo contienen en otra palabra. No sugiere el mismo texto
 * ya escrito.
 */
export function suggestDescriptions(known: string[], query: string, limit = 6): string[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const text of known) {
    const t = normalize(text);
    if (t === q) continue;
    if (t.startsWith(q)) starts.push(text);
    else if (t.includes(q)) contains.push(text);
  }
  return [...starts, ...contains].slice(0, limit);
}
