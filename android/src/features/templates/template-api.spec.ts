import { api } from "@/core/api/api";

import { createTemplateLine } from "./template-api";

jest.mock("@/core/api/api", () => ({ api: { post: jest.fn() } }));

const post = jest.mocked(api.post);

describe("createTemplateLine", () => {
  it("uses templateId only in the route", async () => {
    const line = {
      id: "22222222-2222-4222-8222-222222222222",
      templateId: "11111111-1111-4111-8111-111111111111",
      name: "Loyer",
      amount: 1200,
      kind: "expense" as const,
      recurrence: "fixed" as const,
      description: "",
    };
    post.mockResolvedValueOnce({ data: line });

    await createTemplateLine({
      templateId: line.templateId,
      name: line.name,
      amount: line.amount,
      kind: line.kind,
      recurrence: line.recurrence,
      description: line.description,
    });

    expect(post).toHaveBeenCalledWith(
      `/budget-templates/${line.templateId}/lines`,
      {
        name: line.name,
        amount: line.amount,
        kind: line.kind,
        recurrence: line.recurrence,
        description: line.description,
      },
      expect.anything(),
      expect.anything(),
    );
  });
});
