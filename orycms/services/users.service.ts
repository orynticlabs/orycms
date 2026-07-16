import type {
  OryCMSUser,
  OryCMSCreateUserInput,
  OryCMSUpdateUserInput,
  OryCMSPaginatedResponse,
  OryCMSPaginationParams,
} from "@/types";

export const OryCMSUserService = {
  async findAll(
    _params?: OryCMSPaginationParams & { search?: string; role?: string; status?: string },
  ): Promise<OryCMSPaginatedResponse<OryCMSUser>> {
    throw new Error("Not implemented");
  },

  async findById(_id: string): Promise<OryCMSUser> {
    throw new Error("Not implemented");
  },

  async create(_input: OryCMSCreateUserInput): Promise<OryCMSUser> {
    throw new Error("Not implemented");
  },

  async update(_id: string, _input: OryCMSUpdateUserInput): Promise<OryCMSUser> {
    throw new Error("Not implemented");
  },

  async delete(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async invite(_email: string, _roles: string[]): Promise<void> {
    throw new Error("Not implemented");
  },

  async assignRoles(_id: string, _roles: string[]): Promise<OryCMSUser> {
    throw new Error("Not implemented");
  },

  async deactivate(_id: string): Promise<OryCMSUser> {
    throw new Error("Not implemented");
  },
};
