// Categorías predeterminadas que se crean al registrarse un usuario nuevo
// Estructura: padre (raíz) → hijos (subcategorías)
//
// La principal solo agrupa: los movimientos se asignan a una subcategoría, así
// que toda principal trae al menos una. Las subcategorías usan el color de su
// principal. Los iconos son nombres de Tabler (ver src/lib/category-icons.ts).

export type DefaultCategory = {
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  icon: string;
  children: { name: string; icon?: string }[];
};

export const defaultCategories: DefaultCategory[] = [
  {
    name: "Alimentación",
    kind: "EXPENSE",
    color: "#f59e0b",
    icon: "tools-kitchen-2",
    children: [
      { name: "Supermercado", icon: "shopping-cart" },
      { name: "Restaurantes", icon: "chef-hat" },
      { name: "Comida rápida", icon: "burger" },
      { name: "Café", icon: "coffee" },
    ],
  },
  {
    name: "Transporte",
    kind: "EXPENSE",
    color: "#3b82f6",
    icon: "car",
    children: [
      { name: "Gasolina", icon: "gas-station" },
      { name: "Uber/Taxi", icon: "car-suv" },
      { name: "Transporte público", icon: "bus" },
      { name: "Mantenimiento", icon: "tool" },
    ],
  },
  {
    name: "Vivienda",
    kind: "EXPENSE",
    color: "#8b5cf6",
    icon: "home",
    children: [
      { name: "Renta", icon: "key" },
      { name: "Servicios", icon: "bulb" },
      { name: "Internet", icon: "wifi" },
      { name: "Mantenimiento", icon: "hammer" },
    ],
  },
  {
    name: "Entretenimiento",
    kind: "EXPENSE",
    color: "#ec4899",
    icon: "movie",
    children: [
      { name: "Streaming", icon: "device-tv" },
      { name: "Salidas", icon: "confetti" },
      { name: "Hobbies", icon: "palette" },
    ],
  },
  {
    name: "Salud",
    kind: "EXPENSE",
    color: "#10b981",
    icon: "heartbeat",
    children: [
      { name: "Médico", icon: "stethoscope" },
      { name: "Farmacia", icon: "pill" },
      { name: "Gimnasio", icon: "barbell" },
    ],
  },
  {
    name: "Compras",
    kind: "EXPENSE",
    color: "#f97316",
    icon: "shopping-bag",
    children: [
      { name: "Ropa", icon: "shirt" },
      { name: "Tecnología", icon: "device-laptop" },
      { name: "Hogar", icon: "sofa" },
      { name: "Otros", icon: "package" },
    ],
  },
  {
    name: "Educación",
    kind: "EXPENSE",
    color: "#06b6d4",
    icon: "school",
    children: [
      { name: "Colegiaturas", icon: "school" },
      { name: "Cursos", icon: "certificate" },
      { name: "Libros y material", icon: "books" },
    ],
  },
  {
    name: "Servicios",
    kind: "EXPENSE",
    color: "#64748b",
    icon: "receipt",
    children: [
      { name: "Teléfono", icon: "device-mobile" },
      { name: "Seguros", icon: "shield-check" },
      { name: "Bancos", icon: "building-bank" },
    ],
  },
  {
    name: "Salario",
    kind: "INCOME",
    color: "#22c55e",
    icon: "briefcase",
    children: [
      { name: "Nómina", icon: "cash" },
      { name: "Bonos y aguinaldo", icon: "gift" },
    ],
  },
  {
    name: "Ingresos extra",
    kind: "INCOME",
    color: "#84cc16",
    icon: "trending-up",
    children: [
      { name: "Freelance", icon: "device-laptop" },
      { name: "Ventas", icon: "tag" },
      { name: "Regalos", icon: "gift" },
      { name: "Inversiones", icon: "chart-line" },
    ],
  },
  {
    name: "Otros",
    kind: "EXPENSE",
    color: "#71717a",
    icon: "dots",
    children: [{ name: "Varios", icon: "category" }],
  },
];
