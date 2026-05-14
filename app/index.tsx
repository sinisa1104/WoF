import { Ionicons } from "@expo/vector-icons";
import { id, type InstaQLEntity } from "@instantdb/react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppSchema } from "@/instant.schema";
import { db } from "@/lib/db";

type ChallengeType = "Quest" | "Dayli" | "Weekly";

type Challenge = InstaQLEntity<AppSchema, "challenges">;

const familyMembers = ["Milan", "Mum", "Dad", "Lena"];
const typeStyles: Record<ChallengeType, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Quest: { bg: "#efe7ff", text: "#6d3fd1", icon: "sparkles-outline" },
  Dayli: { bg: "#dcfce7", text: "#167548", icon: "sunny-outline" },
  Weekly: { bg: "#dff3ff", text: "#146c94", icon: "calendar-outline" },
};

const emptyForm = {
  title: "",
  skill: "",
  assignedTo: familyMembers[0],
  due: "",
  points: "20",
};

export default function App() {
  const [activeType, setActiveType] = useState<ChallengeType>("Quest");
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { isLoading, error, data } = db.useQuery({ challenges: {} });
  const challenges = useMemo(
    () =>
      [...(data?.challenges ?? [])].sort(
        (first, second) => second.createdAt - first.createdAt,
      ),
    [data?.challenges],
  );

  const completedPoints = useMemo(
    () =>
      challenges
        .filter((challenge) => challenge.completed)
        .reduce((total, challenge) => total + challenge.points, 0),
    [challenges],
  );

  const openCreator = (type: ChallengeType) => {
    setActiveType(type);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const createChallenge = () => {
    if (!form.title.trim() || !form.assignedTo.trim() || !form.due.trim()) {
      return;
    }

    db.transact(
      db.tx.challenges[id()].update({
        title: form.title.trim(),
        skill: form.skill.trim() || "Fitness",
        assignedTo: form.assignedTo.trim(),
        due: form.due.trim(),
        points: Number(form.points) || 0,
        type: activeType,
        completed: false,
        createdAt: Date.now(),
      }),
    );
    setModalVisible(false);
  };

  const toggleChallenge = (challenge: Challenge) => {
    db.transact(
      db.tx.challenges[challenge.id].update({
        completed: !challenge.completed,
      }),
    );
  };

  return (
    <View className="flex-1 bg-[#f6f7f2]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-14"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6c735e]">
              Family Fitness
            </Text>
            <Text className="mt-2 text-4xl font-black text-[#1d2118]">
              Challenge Board
            </Text>
          </View>
          <View className="rounded-2xl bg-[#1d2118] px-4 py-3">
            <Text className="text-xs font-bold uppercase text-[#c8f26a]">
              Earned
            </Text>
            <Text className="text-2xl font-black text-white">
              {completedPoints} pts
            </Text>
          </View>
        </View>

        <View className="mb-5 flex-row gap-2">
          {(["Quest", "Dayli", "Weekly"] as ChallengeType[]).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              onPress={() => openCreator(type)}
              className="min-h-[46px] flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-white px-2 shadow-sm"
            >
              <Ionicons name="add-circle-outline" size={18} color="#1d2118" />
              <Text className="text-center text-sm font-extrabold text-[#1d2118]">
                New {type}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="mb-4 rounded-3xl bg-[#d8f26a] p-5">
          <Text className="text-base font-extrabold text-[#1d2118]">
            Build skills together
          </Text>
          <Text className="mt-1 text-sm leading-5 text-[#414933]">
            Create quests for strength, speed, focus, flexibility, or any family
            skill. Check them off when they are done and watch the points grow.
          </Text>
        </View>

        <View className="gap-3">
          {isLoading ? (
            <View className="rounded-2xl bg-white p-5">
              <Text className="text-base font-extrabold text-[#1d2118]">
                Loading challenges...
              </Text>
            </View>
          ) : null}

          {error ? (
            <View className="rounded-2xl bg-[#fee2e2] p-5">
              <Text className="text-base font-extrabold text-[#7f1d1d]">
                Could not sync challenges
              </Text>
              <Text className="mt-1 text-sm font-semibold text-[#991b1b]">
                {error.message}
              </Text>
            </View>
          ) : null}

          {!isLoading && !error && challenges.length === 0 ? (
            <View className="rounded-2xl bg-white p-5">
              <Text className="text-base font-extrabold text-[#1d2118]">
                No challenges yet
              </Text>
              <Text className="mt-1 text-sm leading-5 text-[#5d6650]">
                Create your first quest, dayli, or weekly challenge. It will
                appear on every synced device.
              </Text>
            </View>
          ) : null}

          {challenges.map((challenge) => {
            const challengeType = getChallengeType(challenge.type);
            const style = typeStyles[challengeType];

            return (
              <Pressable
                key={challenge.id}
                onPress={() => toggleChallenge(challenge)}
                className={`rounded-2xl border p-4 ${
                  challenge.completed
                    ? "border-[#cbd5c0] bg-[#eef2e8]"
                    : "border-white bg-white"
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className={`mt-1 h-8 w-8 items-center justify-center rounded-full border ${
                      challenge.completed
                        ? "border-[#1d2118] bg-[#1d2118]"
                        : "border-[#aeb8a0] bg-white"
                    }`}
                  >
                    {challenge.completed ? (
                      <Ionicons name="checkmark" size={18} color="white" />
                    ) : null}
                  </View>

                  <View className="flex-1">
                    <View className="mb-2 flex-row flex-wrap items-center gap-2">
                      <View
                        className="flex-row items-center gap-1 rounded-full px-3 py-1"
                        style={{ backgroundColor: style.bg }}
                      >
                        <Ionicons name={style.icon} size={13} color={style.text} />
                        <Text
                          className="text-xs font-black"
                          style={{ color: style.text }}
                        >
                          {challenge.type}
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-[#6c735e]">
                        {challenge.skill}
                      </Text>
                    </View>

                    <Text
                      className={`text-xl font-black ${
                        challenge.completed
                          ? "text-[#6c735e] line-through"
                          : "text-[#1d2118]"
                      }`}
                    >
                      {challenge.title}
                    </Text>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <InfoPill icon="person-outline" label={challenge.assignedTo} />
                      <InfoPill icon="time-outline" label={challenge.due} />
                      <InfoPill
                        icon="trophy-outline"
                        label={`${challenge.points} pts`}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-[28px] bg-white px-5 pb-8 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold uppercase tracking-[2px] text-[#6c735e]">
                  New {activeType}
                </Text>
                <Text className="text-2xl font-black text-[#1d2118]">
                  Create challenge
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close creator"
                onPress={() => setModalVisible(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-[#f0f2ea]"
              >
                <Ionicons name="close" size={20} color="#1d2118" />
              </Pressable>
            </View>

            <FormField
              label="Task"
              placeholder="Example: 20 squats"
              value={form.title}
              onChangeText={(title) => setForm((current) => ({ ...current, title }))}
            />
            <FormField
              label="Special skill"
              placeholder="Strength, balance, stamina..."
              value={form.skill}
              onChangeText={(skill) => setForm((current) => ({ ...current, skill }))}
            />
            <FormField
              label="Time limit"
              placeholder="Today 18:00"
              value={form.due}
              onChangeText={(due) => setForm((current) => ({ ...current, due }))}
            />
            <FormField
              label="Points"
              keyboardType="number-pad"
              placeholder="20"
              value={form.points}
              onChangeText={(points) =>
                setForm((current) => ({ ...current, points }))
              }
            />

            <Text className="mb-2 text-sm font-extrabold text-[#1d2118]">
              Assigned to
            </Text>
            <View className="mb-5 flex-row flex-wrap gap-2">
              {familyMembers.map((member) => {
                const selected = form.assignedTo === member;

                return (
                  <Pressable
                    key={member}
                    onPress={() =>
                      setForm((current) => ({ ...current, assignedTo: member }))
                    }
                    className={`rounded-full px-4 py-2 ${
                      selected ? "bg-[#1d2118]" : "bg-[#f0f2ea]"
                    }`}
                  >
                    <Text
                      className={`font-extrabold ${
                        selected ? "text-white" : "text-[#1d2118]"
                      }`}
                    >
                      {member}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={createChallenge}
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#1d2118]"
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#d8f26a" />
              <Text className="text-base font-black text-white">
                Add {activeType}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getChallengeType(type: string): ChallengeType {
  if (type === "Dayli" || type === "Weekly" || type === "Quest") {
    return type;
  }

  return "Quest";
}

function InfoPill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-[#f0f2ea] px-3 py-1.5">
      <Ionicons name={icon} size={14} color="#5d6650" />
      <Text className="text-xs font-bold text-[#5d6650]">{label}</Text>
    </View>
  );
}

function FormField({
  label,
  ...inputProps
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-extrabold text-[#1d2118]">{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#9aa48d"
        className="min-h-[48px] rounded-2xl bg-[#f0f2ea] px-4 text-base font-semibold text-[#1d2118]"
      />
    </View>
  );
}
