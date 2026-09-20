// Categorías predeterminadas que se crean al registrarse un usuario nuevo
// Estructura: padre (raíz) → hijos (subcategorías)

export type DefaultCategory = {
  name: string;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  color: string;
  icon: string;
  children?: { name: string; color?: string; icon?: string }[];
};

export const defaultCategories: DefaultCategory[] = [
  {
    name: "Alimentación",
    kind: "EXPENSE",
    color: "#f59e0b",
    icon: "Utensils",
    children: [
      { name: "Supermercado" },
      { name: "Restaurantes" },
      { name: "Comida rápida" },
      { name: "Café" },
    ],
  },
  {
    name: "Transporte",
    kind: "EXPENSE",
    color: "#3b82f6",
    icon: "Car",
    children: [
      { name: "Gasolina" },
      { name: "Uber/Taxi" },
      { name: "Transporte público" },
      { name: "Mantenimiento" },
    ],
  },
  {
    name: "Vivienda",
    kind: "EXPENSE",
    color: "#8b5cf6",
    icon: "Home",
    children: [
      { name: "Renta" },
      { name: "Servicios" },
      { name: "Internet" },
      { name: "Mantenimiento" },
    ],
  },
  {
    name: "Entretenimiento",
    kind: "EXPENSE",
    color: "#ec4899",
    icon: "Film",
    children: [
      { name: "Streaming" },
      { name: "Salidas" },
      { name: "Hobbies" },
    ],
  },
  {
    name: "Salud",
    kind: "EXPENSE",
    color: "#10b981",
    icon: "Heart",
    children: [
      { name: "Médico" },
      { name: "Farmacia" },
      { name: "Gimnasio" },
    ],
  },
  {
    name: "Compras",
    kind: "EXPENSE",
    color: "#f97316",
    icon: "ShoppingBag",
    children: [
      { name: "Ropa" },
      { name: "Tecnología" },
      { name: "Hogar" },
      { name: "Otros" },
    ],
  },
  {
    name: "Educación",
    kind: "EXPENSE",
    color: "#06b6d4",
    icon: "GraduationCap",
  },
  {
    name: "Servicios",
    kind: "EXPENSE",
    color: "#64748b",
    icon: "Receipt",
    children: [
      { name: "Teléfono" },
      { name: "Seguros" },
      { name: "Bancos" },
    ],
  },
  {
    name: "Salario",
    kind: "INCOME",
    color: "#22c55e",
    icon: "Briefcase",
  },
  {
    name: "Ingresos extra",
    kind: "INCOME",
    color: "#84cc16",
    icon: "TrendingUp",
    children: [
      { name: "Freelance" },
      { name: "Ventas" },
      { name: "Regalos" },
      { name: "Inversiones" },
    ],
  },
  {
    name: "Otros",
    kind: "BOTH",
    color: "#71717a",
    icon: "Circle",
  },
];