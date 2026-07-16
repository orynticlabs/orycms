import type {
  OryCMSCollection,
  OryCMSCreateCollectionInput,
  OryCMSUpdateCollectionInput,
  OryCMSField,
  OryCMSPaginatedResponse,
  OryCMSPaginationParams,
} from "@/types";

export const OryCMSCollectionService = {
  async findAll(
    _params?: OryCMSPaginationParams,
  ): Promise<OryCMSPaginatedResponse<OryCMSCollection>> {
    throw new Error("Not implemented");
  },

  async findBySlug(_slug: string): Promise<OryCMSCollection> {
    throw new Error("Not implemented");
  },

  async create(_input: OryCMSCreateCollectionInput): Promise<OryCMSCollection> {
    throw new Error("Not implemented");
  },

  async update(_slug: string, _input: OryCMSUpdateCollectionInput): Promise<OryCMSCollection> {
    throw new Error("Not implemented");
  },

  async delete(_slug: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async addField(
    _slug: string,
    _field: Omit<OryCMSField, "id" | "sortOrder">,
  ): Promise<OryCMSField> {
    throw new Error("Not implemented");
  },

  async updateField(
    _slug: string,
    _fieldId: string,
    _field: Partial<OryCMSField>,
  ): Promise<OryCMSField> {
    throw new Error("Not implemented");
  },

  async deleteField(_slug: string, _fieldId: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async reorderFields(_slug: string, _fieldIds: string[]): Promise<void> {
    throw new Error("Not implemented");
  },
};
