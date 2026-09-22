import { describe, expect, it } from "vitest";
import { describeWait, formatCountdown, retryAfterSeconds } from "@/lib/useCountdown";

describe("formatCountdown", () => {
  it("formats as m:ss", () => {
    expect(formatCountdown(553)).toBe("9:13");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(61)).toBe("1:01");
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("rounds partial seconds up and never goes negative", () => {
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("describeWait", () => {
  it("uses seconds under a minute and rounded-up minutes above", () => {
    expect(describeWait(1)).toBe("1 second");
    expect(describeWait(45)).toBe("45 seconds");
    expect(describeWait(60)).toBe("about 1 minute");
    expect(describeWait(553)).toBe("about 10 minutes");
  });
});

describe("retryAfterSeconds", () => {
  const withHeader = (value?: string) =>
    new Response(null, { status: 429, headers: value === undefined ? {} : { "Retry-After": value } });

  it("reads a valid Retry-After header", () => {
    expect(retryAfterSeconds(withHeader("553"))).toBe(553);
  });

  it("returns null when it is missing or not a positive number", () => {
    expect(retryAfterSeconds(withHeader())).toBeNull();
    expect(retryAfterSeconds(withHeader("soon"))).toBeNull();
    expect(retryAfterSeconds(withHeader("0"))).toBeNull();
    expect(retryAfterSeconds(withHeader("-3"))).toBeNull();
  });
});