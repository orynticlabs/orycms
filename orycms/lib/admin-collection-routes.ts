export function adminCollectionsPath(): string {
  return "/admin/collections";
}

export function adminCollectionCreatePath(): string {
  return "/admin/collections/create";
}

export function adminCollectionEditPath(collection: string): string {
  return `/admin/collections/${collection}/edit`;
}
