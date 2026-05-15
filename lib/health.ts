import { Platform } from "react-native";

type HealthConnectModule = typeof import("react-native-health-connect");

export type DailyStepsResult = {
  steps: number | null;
  message: string;
};

export async function readTodaySteps(): Promise<DailyStepsResult> {
  if (process.env.EXPO_PUBLIC_USE_MOCK_HEALTH !== "false") {
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      steps: createMockSteps(),
      message: "Mock steps loaded for Expo Go. Real Health Connect needs a custom build.",
    };
  }

  if (Platform.OS !== "android") {
    return {
      steps: null,
      message: "Health Connect step sync is available on Android custom builds.",
    };
  }

  try {
    const healthConnect = (await import(
      "react-native-health-connect"
    )) as HealthConnectModule;
    const initialized = await healthConnect.initialize();

    if (!initialized) {
      return {
        steps: null,
        message: "Health Connect could not be opened on this device.",
      };
    }

    const permissions = await healthConnect.requestPermission([
      { accessType: "read", recordType: "Steps" },
    ]);
    const canReadSteps = permissions.some(
      (permission) =>
        permission.accessType === "read" && permission.recordType === "Steps",
    );

    if (!canReadSteps) {
      return {
        steps: null,
        message: "Steps permission was not granted.",
      };
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const { records } = await healthConnect.readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const steps = records.reduce(
      (total, record) => total + Number(record.count || 0),
      0,
    );

    return {
      steps,
      message: "Today's steps synced from Health Connect.",
    };
  } catch (error) {
    return {
      steps: null,
      message:
        error instanceof Error
          ? error.message
          : "Could not read Health Connect steps.",
    };
  }
}

function createMockSteps() {
  const daySeed = new Date().toISOString().slice(0, 10);
  const seed = [...daySeed].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return 3500 + ((seed * 137) % 8500);
}
