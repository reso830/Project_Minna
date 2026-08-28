/** @jest-environment node */

import { GET as listWorkItems } from "../route";
import { PATCH as updateWorkItem } from "../[id]/route";

describe("work-item route validation", () => {
  it("rejects incomplete requests", async () => {
    await expect(listWorkItems(new Request("http://localhost/api/work-items"))).resolves.toMatchObject({ status: 400 });
    await expect(updateWorkItem(new Request("http://localhost/api/work-items/001", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "001" }) })).resolves.toMatchObject({ status: 400 });

    await expect((await listWorkItems(new Request("http://localhost/api/work-items"))).json()).resolves.toEqual({ error: "Bad Request", message: "Missing required query parameter: project" });
  });
});
