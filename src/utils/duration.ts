export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const multiplier = multipliers[match[2]];

  if (!multiplier || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid duration: ${value}`);
  }

  return amount * multiplier;
}
