// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react-native";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
      username: i.string().optional(),
      status: i.string().optional(),
      role: i.string().optional(),
      joinedAt: i.number().optional(),
    }),
    colors: i.entity({
      value: i.string(),
    }),
    challenges: i.entity({
      title: i.string(),
      skill: i.string(),
      assignedTo: i.string(),
      due: i.string(),
      points: i.number(),
      type: i.string(),
      completed: i.boolean(),
      createdAt: i.number(),
    }),
  },
  rooms: {},
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
  },
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
