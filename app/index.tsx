import { Ionicons } from "@expo/vector-icons";
import { id, type InstaQLEntity } from "@instantdb/react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
type AppPage = "Challenges" | "Milanos" | "PersonalGoals" | "Rewards";

type Challenge = InstaQLEntity<AppSchema, "challenges">;
type FamilyUser = InstaQLEntity<AppSchema, "$users">;

const ownerEmail = "milanovic.sini@gmail.com";
const authApiUrl = process.env.EXPO_PUBLIC_AUTH_API_URL || "http://localhost:8787";
const typeStyles: Record<ChallengeType, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Quest: { bg: "#efe7ff", text: "#6d3fd1", icon: "sparkles-outline" },
  Dayli: { bg: "#dcfce7", text: "#167548", icon: "sunny-outline" },
  Weekly: { bg: "#dff3ff", text: "#146c94", icon: "calendar-outline" },
};

const emptyForm = {
  title: "",
  skill: "",
  assignedTo: "",
  due: "",
  points: "20",
};

export default function App() {
  const auth = db.useAuth();
  const usersQuery = db.useQuery(auth.user ? { $users: {} } : null);

  if (auth.isLoading) {
    return <LoadingScreen label="Opening family fitness..." />;
  }

  if (auth.error) {
    return <MessageScreen title="Login error" message={auth.error.message} />;
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

  if (usersQuery.isLoading) {
    return <LoadingScreen label="Checking family access..." />;
  }

  if (usersQuery.error) {
    return <MessageScreen title="Access error" message={usersQuery.error.message} />;
  }

  const familyUsers = usersQuery.data?.$users ?? [];
  const currentUser = familyUsers.find((user) => user.id === auth.user?.id);
  const isOwner = auth.user.email?.toLowerCase() === ownerEmail;
  const isApproved = isOwner || currentUser?.status === "approved";

  if (!isApproved) {
    return (
      <PendingApprovalScreen
        email={auth.user.email ?? ""}
        username={currentUser?.username}
      />
    );
  }

  return (
    <ChallengeBoard
      familyUsers={familyUsers}
      isOwner={isOwner}
      signedInEmail={auth.user.email ?? ""}
      signedInName={currentUser?.username || auth.user.email || "Family member"}
    />
  );
}

function ChallengeBoard({
  familyUsers,
  isOwner,
  signedInEmail,
  signedInName,
}: {
  familyUsers: FamilyUser[];
  isOwner: boolean;
  signedInEmail: string;
  signedInName: string;
}) {
  const [activeType, setActiveType] = useState<ChallengeType>("Quest");
  const [activePage, setActivePage] = useState<AppPage>("Challenges");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { isLoading, error, data } = db.useQuery({ challenges: {} });
  const assignableMembers = useMemo(() => {
    const members = familyUsers
      .filter(
        (user) =>
          user.status === "approved" ||
          user.email?.toLowerCase() === ownerEmail,
      )
      .map((user) => user.username || user.email || "Family member");

    return members.length > 0 ? members : [signedInEmail || "Family member"];
  }, [familyUsers, signedInEmail]);

  const pendingUsers = useMemo(
    () =>
      familyUsers.filter(
        (user) =>
          user.status === "pending" &&
          user.email?.toLowerCase() !== ownerEmail,
      ),
    [familyUsers],
  );
  const approvedUsers = useMemo(
    () =>
      familyUsers.filter(
        (user) =>
          user.status === "approved" ||
          user.email?.toLowerCase() === ownerEmail,
      ),
    [familyUsers],
  );
  const challenges = useMemo(
    () =>
      [...(data?.challenges ?? [])].sort(
        (first, second) => second.createdAt - first.createdAt,
      ),
    [data?.challenges],
  );
  const visibleChallenges = useMemo(
    () =>
      showOnlyMine
        ? challenges.filter((challenge) => challenge.assignedTo === signedInName)
        : challenges,
    [challenges, showOnlyMine, signedInName],
  );

  const completedPoints = useMemo(
    () =>
      challenges
        .filter(
          (challenge) =>
            challenge.completed && challenge.assignedTo === signedInName,
        )
        .reduce((total, challenge) => total + challenge.points, 0),
    [challenges, signedInName],
  );

  const openCreator = (type: ChallengeType) => {
    setActiveType(type);
    setForm({ ...emptyForm, assignedTo: assignableMembers[0] ?? "" });
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
    if (!isOwner && challenge.assignedTo !== signedInName) {
      return;
    }

    db.transact(
      db.tx.challenges[challenge.id].update({
        completed: !challenge.completed,
      }),
    );
  };

  const deleteChallenge = (challenge: Challenge) => {
    if (!isOwner || !challenge.completed) {
      return;
    }

    db.transact(db.tx.challenges[challenge.id].delete());
  };

  const approveUser = (user: FamilyUser) => {
    db.transact(
      db.tx.$users[user.id].update({
        status: "approved",
        role: "member",
      }),
    );
  };

  const removeUserAccess = (user: FamilyUser) => {
    if (user.email?.toLowerCase() === ownerEmail) {
      return;
    }

    db.transact(
      db.tx.$users[user.id].update({
        status: "removed",
        role: "removed",
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
              {getPageTitle(activePage, signedInName)}
            </Text>
          </View>
          <View className="rounded-2xl bg-[#1d2118] px-4 py-3">
            <Text className="text-xs font-bold uppercase text-[#c8f26a]">
              My points
            </Text>
            <Text className="text-2xl font-black text-white">
              {completedPoints} pts
            </Text>
          </View>
        </View>

        <View className="mb-4 flex-row gap-2">
          {[
            { key: "Challenges", label: "Challenges" },
            { key: "Milanos", label: "Milanos" },
            { key: "PersonalGoals", label: signedInName },
            { key: "Rewards", label: "Rewards" },
          ].map((page) => {
            const selected = activePage === page.key;

            return (
              <Pressable
                key={page.key}
                accessibilityRole="button"
                onPress={() => setActivePage(page.key as AppPage)}
                className={`min-h-[42px] flex-1 items-center justify-center rounded-xl px-2 ${
                  selected ? "bg-[#1d2118]" : "bg-white"
                }`}
              >
                <Text
                  className={`text-center text-xs font-black ${
                    selected ? "text-white" : "text-[#1d2118]"
                  }`}
                  numberOfLines={1}
                >
                  {page.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-[1px] text-[#6c735e]">
              Signed in
            </Text>
            <Text className="text-sm font-extrabold text-[#1d2118]">
              {signedInName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => db.auth.signOut()}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#f0f2ea]"
          >
            <Ionicons name="log-out-outline" size={18} color="#1d2118" />
          </Pressable>
        </View>

        {activePage === "Challenges" && isOwner ? (
          <View className="mb-4 rounded-2xl bg-white p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-[1px] text-[#6c735e]">
                  Admin
                </Text>
                <Text className="text-base font-black text-[#1d2118]">
                  Family approvals
                </Text>
              </View>
              <View className="rounded-full bg-[#efe7ff] px-3 py-1">
                <Text className="text-xs font-black text-[#6d3fd1]">
                  {pendingUsers.length} pending
                </Text>
              </View>
            </View>

            <View className="mt-3 gap-2">
              {pendingUsers.length === 0 ? (
                <View className="rounded-xl bg-[#f0f2ea] p-3">
                  <Text className="font-black text-[#1d2118]">
                    No pending requests
                  </Text>
                  <Text className="mt-1 text-xs font-semibold text-[#6c735e]">
                    New signups appear here after they verify their email code.
                  </Text>
                </View>
              ) : (
                pendingUsers.map((user) => (
                  <View
                    key={user.id}
                    className="flex-row items-center justify-between gap-3 rounded-xl bg-[#f0f2ea] p-3"
                  >
                    <View className="flex-1">
                      <Text className="font-black text-[#1d2118]">
                        {user.username || "New member"}
                      </Text>
                      <Text className="text-xs font-semibold text-[#6c735e]">
                        {user.email}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => approveUser(user)}
                        className="rounded-full bg-[#1d2118] px-4 py-2"
                      >
                        <Text className="text-sm font-black text-white">
                          Approve
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel="Remove user access"
                        accessibilityRole="button"
                        onPress={() => removeUserAccess(user)}
                        className="h-9 w-9 items-center justify-center rounded-full bg-[#fee2e2]"
                      >
                        <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>

            <Text className="mt-4 text-xs font-bold uppercase tracking-[1px] text-[#6c735e]">
              Approved family
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {approvedUsers.map((user) => {
                const isOwnerUser = user.email?.toLowerCase() === ownerEmail;

                return (
                  <View
                    key={user.id}
                    className="flex-row items-center gap-2 rounded-full bg-[#dcfce7] px-3 py-1.5"
                  >
                    <Text className="text-xs font-black text-[#167548]">
                      {user.username || user.email || "Family member"}
                    </Text>
                    {!isOwnerUser ? (
                      <Pressable
                        accessibilityLabel="Remove user access"
                        accessibilityRole="button"
                        onPress={() => removeUserAccess(user)}
                        className="h-6 w-6 items-center justify-center rounded-full bg-[#bbf7d0]"
                      >
                        <Ionicons name="trash-outline" size={13} color="#166534" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {activePage === "Challenges" ? (
          <>
            {isOwner ? (
              <View className="mb-5 flex-row gap-2">
                {(["Quest", "Dayli", "Weekly"] as ChallengeType[]).map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    onPress={() => openCreator(type)}
                    className="min-h-[46px] flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-white px-2 shadow-sm"
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color="#1d2118"
                    />
                    <Text className="text-center text-sm font-extrabold text-[#1d2118]">
                      New {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setShowOnlyMine((current) => !current)}
              className={`mb-4 min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl px-4 ${
                showOnlyMine ? "bg-[#d8f26a]" : "bg-white"
              }`}
            >
              <Ionicons
                name={showOnlyMine ? "person" : "people-outline"}
                size={17}
                color="#1d2118"
              />
              <Text className="font-black text-[#1d2118]">
                {showOnlyMine ? `${signedInName}'s tasks` : `Show ${signedInName}`}
              </Text>
            </Pressable>

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

          {!isLoading && !error && visibleChallenges.length === 0 ? (
            <View className="rounded-2xl bg-white p-5">
              <Text className="text-base font-extrabold text-[#1d2118]">
                {showOnlyMine ? "No tasks assigned to you" : "No challenges yet"}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-[#5d6650]">
                {showOnlyMine
                  ? "Tap the filter again to see all family challenges."
                  : "The admin can create the first quest, dayli, or weekly challenge."}
              </Text>
            </View>
          ) : null}

          {visibleChallenges.map((challenge) => {
            const challengeType = getChallengeType(challenge.type);
            const style = typeStyles[challengeType];
            const canToggleChallenge = isOwner || challenge.assignedTo === signedInName;

            return (
              <Pressable
                key={challenge.id}
                onPress={() => toggleChallenge(challenge)}
                accessibilityState={{ disabled: !canToggleChallenge }}
                className={`rounded-2xl border p-4 pr-16 ${
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
                        : canToggleChallenge
                          ? "border-[#aeb8a0] bg-white"
                          : "border-[#d7ddce] bg-[#f0f2ea]"
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

                {isOwner ? (
                  <Pressable
                    accessibilityLabel="Delete task"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !challenge.completed }}
                    onPress={(event) => {
                      event.stopPropagation();
                      deleteChallenge(challenge);
                    }}
                    className={`absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full ${
                      challenge.completed ? "bg-[#fee2e2]" : "bg-[#eef0e9]"
                    }`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={challenge.completed ? "#b91c1c" : "#8b9480"}
                    />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
            </View>
          </>
        ) : (
          <EmptyPage activePage={activePage} signedInName={signedInName} />
        )}
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
              {assignableMembers.map((member) => {
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

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const loginWithUsername = async () => {
    if (username.trim().length < 2 || password.length < 6) {
      setError("Enter your username and password.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const { token } = await postAuth("/login", {
        username: username.trim(),
        password,
      });

      await db.auth.signInWithToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not login.");
    } finally {
      setIsBusy(false);
    }
  };

  const startRegister = () => {
    setIsRegistering(true);
    setError("");
  };

  const sendCode = async () => {
    if (!normalizedEmail || username.trim().length < 2 || password.length < 6) {
      setError("Enter username, email, and a password with at least 6 characters.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      await db.auth.sendMagicCode({ email: normalizedEmail });
      setSentEmail(normalizedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send login code.");
    } finally {
      setIsBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!sentEmail || !code.trim()) {
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const { token } = await postAuth("/register", {
        username: username.trim(),
        email: sentEmail,
        password,
        code: code.trim(),
      });

      await db.auth.signInWithToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify login code.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-[#f6f7f2] px-5">
      <View className="mb-8">
        <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#6c735e]">
          Family Fitness
        </Text>
        <Text className="mt-2 text-4xl font-black text-[#1d2118]">
          Welcome back
        </Text>
      </View>

      <View className="rounded-3xl bg-white p-5">
        <FormField
          label="Username"
          placeholder="Sini"
          value={username}
          onChangeText={setUsername}
        />
        <FormField
          label="Password"
          placeholder="At least 6 characters"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {isRegistering ? (
          <>
            <FormField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
            />

            {sentEmail ? (
              <>
                <FormField
                  keyboardType="number-pad"
                  label="Login code"
                  placeholder="123456"
                  value={code}
                  onChangeText={setCode}
                />
                <Text className="mb-4 text-sm font-semibold leading-5 text-[#5d6650]">
                  The approval request is created after this code is verified.
                </Text>
              </>
            ) : null}
          </>
        ) : null}

        {error ? (
          <Text className="mb-4 rounded-xl bg-[#fee2e2] px-4 py-3 text-sm font-bold text-[#991b1b]">
            {error}
          </Text>
        ) : null}

        {isRegistering ? (
          <Pressable
            accessibilityRole="button"
            onPress={sentEmail ? verifyCode : sendCode}
            className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#1d2118]"
          >
            {isBusy ? (
              <ActivityIndicator color="#d8f26a" />
            ) : (
              <Ionicons name="mail-outline" size={20} color="#d8f26a" />
            )}
            <Text className="text-base font-black text-white">
              {sentEmail ? "Verify code" : "Send code"}
            </Text>
          </Pressable>
        ) : (
          <View className="gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={loginWithUsername}
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#1d2118]"
            >
              {isBusy ? (
                <ActivityIndicator color="#d8f26a" />
              ) : (
                <Ionicons name="log-in-outline" size={20} color="#d8f26a" />
              )}
              <Text className="text-base font-black text-white">Login</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={startRegister}
              className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#f0f2ea]"
            >
              <Ionicons name="person-add-outline" size={20} color="#1d2118" />
              <Text className="text-base font-black text-[#1d2118]">
                Register
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function PendingApprovalScreen({
  email,
  username,
}: {
  email: string;
  username?: string;
}) {
  return (
    <View className="flex-1 justify-center bg-[#f6f7f2] px-5">
      <View className="rounded-3xl bg-white p-6">
        <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-[#efe7ff]">
          <Ionicons name="hourglass-outline" size={24} color="#6d3fd1" />
        </View>
        <Text className="text-3xl font-black text-[#1d2118]">
          Waiting for approval
        </Text>
        <Text className="mt-3 text-base leading-6 text-[#5d6650]">
          {username || email} is signed in. Sini needs to approve this account
          before the challenge board opens.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => db.auth.signOut()}
          className="mt-6 min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl bg-[#1d2118]"
        >
          <Ionicons name="log-out-outline" size={18} color="#d8f26a" />
          <Text className="font-black text-white">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-[#f6f7f2] px-5">
      <ActivityIndicator color="#1d2118" size="large" />
      <Text className="mt-4 text-base font-black text-[#1d2118]">{label}</Text>
    </View>
  );
}

function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-1 justify-center bg-[#f6f7f2] px-5">
      <View className="rounded-3xl bg-white p-6">
        <Text className="text-2xl font-black text-[#1d2118]">{title}</Text>
        <Text className="mt-2 text-base text-[#5d6650]">{message}</Text>
      </View>
    </View>
  );
}

function EmptyPage({
  activePage,
  signedInName,
}: {
  activePage: AppPage;
  signedInName: string;
}) {
  return (
    <View className="rounded-2xl bg-white p-6">
      <Text className="text-2xl font-black text-[#1d2118]">
        {getPageTitle(activePage, signedInName)}
      </Text>
    </View>
  );
}

async function postAuth(
  path: "/login" | "/register",
  body: Record<string, string>,
): Promise<{ token: string }> {
  const response = await fetch(`${authApiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Authentication failed.");
  }

  return data;
}

function getPageTitle(activePage: AppPage, signedInName: string) {
  if (activePage === "Milanos") {
    return "Milanos";
  }

  if (activePage === "PersonalGoals") {
    return signedInName;
  }

  if (activePage === "Rewards") {
    return "Rewards";
  }

  return "Challenge Board";
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
