export const ITEMS_PER_PAGE = 9;

export const getItemPage = (index: number) => Math.max(1, Math.floor(index / ITEMS_PER_PAGE) + 1);

export const clampItemPage = (value: string | number | null, itemCount: number) => {
  const page = Number(value);
  const totalPages = Math.max(1, Math.ceil(itemCount / ITEMS_PER_PAGE));
  return Math.min(totalPages, Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1);
};
