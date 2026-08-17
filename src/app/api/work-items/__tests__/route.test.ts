/** @jest-environment node */

import { GET as listWorkItems } from "../route";
import { PATCH as updateWorkItem } from "../[id]/route";
import { POST as dropWorkItem } from "../[id]/drop/route";

describe("work-item route validation", () => {
  it("rejects incomplete requests", async () => {
    await expect(listWorkItems(new Request("http://localhost/api/work-items"))).resolves.toMatchObject({ status: 400 });
    await expect(updateWorkItem(new Request("http://localhost/api/work-items/001", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "001" }) })).resolves.toMatchObject({ status: 400 });
    await expect(dropWorkItem(new Request("http://localhost/api/work-items/001/drop", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "001" }) })).resolves.toMatchObject({ status: 400 });

    await expect((await listWorkItems(new Request("http://localhost/api/work-items"))).json()).resolves.toEqual({ error: "Bad Request", message: "Missing required query parameter: project" });
    await expect((await dropWorkItem(new Request("http://localhost/api/work-items/001/drop", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "001" }) })).json()).resolves.toEqual({ error: "Bad Request", message: "Missing required field: project" });
  });
});
