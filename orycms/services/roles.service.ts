import type {
  OryCMSRole,
  OryCMSCreateRoleInput,
  OryCMSUpdateRoleInput,
  OryCMSPermission,
} from "@/types";

export const OryCMSRoleService = {
  async findAll(): Promise<OryCMSRole[]> {
    throw new Error("Not implemented");
  },

  async findById(_id: string): Promise<OryCMSRole> {
    throw new Error("Not implemented");
  },

  async create(_input: OryCMSCreateRoleInput): Promise<OryCMSRole> {
    throw new Error("Not implemented");
  },

  async update(_id: string, _input: OryCMSUpdateRoleInput): Promise<OryCMSRole> {
    throw new Error("Not implemented");
  },

  async delete(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async updatePermissions(_id: string, _permissions: OryCMSPermission[]): Promise<OryCMSRole> {
    throw new Error("Not implemented");
  },
};
