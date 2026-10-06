import { describe, expect, it } from "vitest";
import { groupByRootCategory, ROOT_ONLY_LABEL } from "./categories";

const comida = { id: "comida", name: "Comida", color: "#f00", icon: null, parent: null };
const sub = (id: string, name: string) => ({
  id,
  name,
  color: null,
  icon: null,
  parent: { id: comida.id, name: comida.name, color: comida.color, icon: null },
});
const super_ = sub("super", "Súper");
const restaurantes = sub("rest", "Restaurantes");

describe("groupByRootCategory", () => {
  it("agrupa por raíz y desglosa por subcategoría", () => {
    const [root] = groupByRootCategory([
      { amount: 300, categoryRef: super_ },
      { amount: 100, categoryRef: restaurantes },
      { amount: 200, categoryRef: super_ },
    ]);
    expect(root).toMatchObject({ categoryId: "comida", total: 600, count: 3, percent: 100 });
    expect(root.children.map((c) => [c.categoryName, c.total, c.count])).toEqual([
      ["Súper", 500, 2],
      ["Restaurantes", 100, 1],
    ]);
    expect(root.children[1].percent).toBeCloseTo(100 / 6);
  });

  it("los movimientos asignados a la raíz van en su propia fila", () => {
    const [root] = groupByRootCategory([
      { amount: 50, categoryRef: comida },
      { amount: 150, categoryRef: super_ },
    ]);
    expect(root.total).toBe(200);
    expect(root.children.map((c) => [c.categoryName, c.total])).toEqual([
      ["Súper", 150],
      [ROOT_ONLY_LABEL, 50],
    ]);
  });

  it("sin categoría no tiene desglose", () => {
    const [root] = groupByRootCategory([{ amount: "20.5", categoryRef: null }]);
    expect(root).toMatchObject({ categoryName: "Sin categoría", total: 20.5, children: [] });
  });
});
