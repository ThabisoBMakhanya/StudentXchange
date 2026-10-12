const CATEGORY_ICON_MAP: Record<string, string> = {
  'cat-phys-1': 'chip', 'cat-phys-1-1': 'laptop', 'cat-phys-1-2': 'phone', 'cat-phys-1-3': 'headphones', 'cat-phys-1-4': 'calculator',
  'cat-phys-2': 'sofa', 'cat-phys-2-1': 'desk', 'cat-phys-2-2': 'bed', 'cat-phys-2-3': 'box',
  'cat-phys-3': 'shirt', 'cat-phys-3-1': 'shoe', 'cat-phys-3-2': 'bag', 'cat-phys-3-3': 'jacket',
  'cat-phys-4': 'food', 'cat-phys-4-1': 'meal', 'cat-phys-4-2': 'snack',
  'cat-phys-5': 'sparkles', 'cat-phys-6': 'dumbbell', 'cat-phys-7': 'pencil', 'cat-phys-8': 'grid',
  'cat-serv-1': 'book', 'cat-serv-1-1': 'calculator', 'cat-serv-1-2': 'flask', 'cat-serv-1-3': 'chat', 'cat-serv-1-4': 'clipboard',
  'cat-serv-2': 'printer', 'cat-serv-3': 'washer', 'cat-serv-4': 'truck', 'cat-serv-5': 'wrench',
  'cat-serv-6': 'scissors', 'cat-serv-7': 'camera', 'cat-serv-8': 'bed', 'cat-serv-9': 'grid',
};

export function categoryIcon(categoryId: string): string {
  return CATEGORY_ICON_MAP[categoryId] ?? 'grid';
}
