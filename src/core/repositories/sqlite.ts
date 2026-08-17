import {
  appendWorkItemEvent,
  createWorkItem,
  readWorkItemEvents,
  readWorkItems,
  updateWorkItem,
  updateWorkItemState,
  type AppendWorkItemEventInput,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
  type UpdateWorkItemStateInput,
} from "../work-items.js";
import type { WorkItemActor } from "../types.js";
import type { IEventsRepository, IWorkItemsRepository, SqliteConnection } from "./types.js";

export class SqliteWorkItemsRepository implements IWorkItemsRepository {
  constructor(private readonly db: SqliteConnection, private readonly projectPath?: string) {}

  create(actor: WorkItemActor, input: CreateWorkItemInput) {
    return createWorkItem(this.db, actor, { ...input, project_path: input.project_path ?? this.projectPath });
  }

  update(actor: WorkItemActor, id: string, input: UpdateWorkItemInput) {
    return updateWorkItem(this.db, actor, id, { ...input, project_path: input.project_path ?? this.projectPath });
  }

  updateState(actor: WorkItemActor, id: string, input: UpdateWorkItemStateInput) {
    return updateWorkItemState(this.db, actor, id, input);
  }

  list(filter?: { project?: string }) {
    return readWorkItems(this.db, { ...filter, project_path: this.projectPath });
  }
}

export class SqliteEventsRepository implements IEventsRepository {
  constructor(private readonly db: SqliteConnection) {}

  append(input: AppendWorkItemEventInput) {
    return appendWorkItemEvent(this.db, input);
  }

  read(workItemId: string) {
    return readWorkItemEvents(this.db, workItemId);
  }
}
