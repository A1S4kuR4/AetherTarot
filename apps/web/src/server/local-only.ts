export const LOCAL_ONLY_ENV_VAR = "AETHERTAROT_LOCAL_ONLY";

export type RuntimeEnvironment = Readonly<Partial<NodeJS.ProcessEnv>>;

export function isLocalOnlyModeEnabled(
  env: RuntimeEnvironment = process.env,
) {
  return env.NODE_ENV !== "production" && env[LOCAL_ONLY_ENV_VAR] === "1";
}
