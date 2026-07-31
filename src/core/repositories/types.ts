import type { DatabaseSync } from "node:sqlite";
import type {
  WorkItem,
  WorkItemActor,
  WorkItemEvent,
} from "../types.js";
import type {
  AppendWorkItemEventInput,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  UpdateWorkItemStateInput,
} from "../work-items.js";

export interface IWorkItemsRepository {
  create(actor: WorkItemActor, input: CreateWorkItemInput): Promise<WorkItem>;
  update(actor: WorkItemActor, id: string, input: UpdateWorkItemInput): Promise<WorkItem>;
  updateState(actor: WorkItemActor, id: string, input: UpdateWorkItemStateInput): Promise<WorkItem>;
  list(filter?: { project?: string }): Promise<WorkItem[]>;
}

export interface IEventsRepository {
  append(input: AppendWorkItemEventInput): Promise<WorkItemEvent & { id: number }>;
  read(workItemId: string): Promise<Array<WorkItemEvent & { id: number }>>;
}

export interface Repositories {
  workItems: IWorkItemsRepository;
  events: IEventsRepository;
  close(): void;
}

export interface RepositoriesConfig {
  dbPath: string;
  projectKey?: string;
  projectPath?: string;
}

export type SqliteConnection = DatabaseSync;
