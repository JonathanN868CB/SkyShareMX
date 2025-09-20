export type DeleteUserResponse = {
  ok: boolean;
  message: string;
};

export async function deleteUser(userId: string): Promise<DeleteUserResponse> {
  void userId;
  return Promise.resolve({
    ok: false,
    message: "Disabled in Workbench (mock data)",
  });
}
