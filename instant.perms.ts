// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react-native";

const rules = {
  $users: {
    allow: {
      view: "isAdmin || auth.id == data.id || data.status == 'approved'",
      create: "data.username != null && data.username.size() >= 2",
      update:
        "isAdmin || (auth.id == data.id && request.modifiedFields.all(field, field in ['username', 'status', 'role']) && newData.status == 'pending' && newData.role == 'member')",
    },
    fields: {
      email: "isAdmin || auth.id == data.id",
    },
    bind: {
      isAdmin: "'admin' in auth.ref('$user.role')",
    },
  },
  challenges: {
    allow: {
      view: "isApproved",
      create: "isApproved",
      update:
        "isAdmin || (isApproved && data.assignedTo in auth.ref('$user.username') && request.modifiedFields == ['completed'])",
      delete: "isAdmin && data.completed == true",
    },
    bind: {
      isAdmin: "'admin' in auth.ref('$user.role')",
      isApproved:
        "'admin' in auth.ref('$user.role') || 'approved' in auth.ref('$user.status')",
    },
  },
  userCredentials: {
    allow: {
      view: "isAdmin",
      create: "isAdmin",
      update: "isAdmin",
      delete: "isAdmin",
    },
    bind: {
      isAdmin: "'admin' in auth.ref('$user.role')",
    },
  },
} satisfies InstantRules;

export default rules;
