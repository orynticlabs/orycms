export function adminContentIndexPath(): string {
  return "/admin/content";
}

export function adminContentListPath(collection: string): string {
  return `/admin/content/${collection}`;
}

export function adminContentCreatePath(collection: string): string {
  return `${adminContentListPath(collection)}/create`;
}

export function adminContentEditPath(collection: string, id: string): string {
  return `${adminContentListPath(collection)}/${id}/edit`;
}

export function legacyCollectionContentListPath(collection: string): string {
  return `/collections/${collection}/content`;
}

export function legacyCollectionContentCreatePath(collection: string): string {
  return `${legacyCollectionContentListPath(collection)}/new`;
}

export function legacyCollectionContentEditPath(collection: string, id: string): string {
  return `${legacyCollectionContentListPath(collection)}/${id}/edit`;
}
