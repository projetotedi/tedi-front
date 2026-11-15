import { http, HttpResponse } from "msw";

import type { MyProfileResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW written by hand over the real contract (GET /members/me). The path has a wildcard
 * prefix because http-client.ts prefixes the URL with VITE_API_URL at runtime: the test does not
 * need to know it.
 */

/** A member whose registration was approved: every field of the contract example is filled. */
export function buildMyProfile(
  overrides: Partial<MyProfileResponseDto> = {},
): MyProfileResponseDto {
  return {
    name: "Ana Torres",
    ra: "a2210001",
    role: Role.member,
    accessEnabled: true,
    birthDate: "1999-07-22",
    phone: "11981813030",
    email: "ana.torres@example.com",
    personalEmail: "ana.torres@example.com",
    address: "Rua das Acácias, 120, apto 42",
    city: "São Paulo",
    state: "SP",
    institutionalEmail: "ana.torres@example.edu",
    course: "Sistemas de Informação",
    semester: 7,
    className: "SI-2024-N",
    volunteerTermUrl: "https://drive.google.com/file/d/exemplo/view",
    mainFunction: "Monitora de informática",
    department: { id: "01952ef7-0000-7000-8000-0000000000d1", name: "Tecnologia" },
    joinedAt: "2026-10-01",
    cpfMasked: "***.***.247-25",
    lastLoginAt: "2026-10-20T13:00:00.000Z",
    ...overrides,
  };
}

/**
 * The seeded coordinator: a Person with an access profile but no member profile. The seed gives
 * her RA, name and e-mail (ADMIN_RA, ADMIN_NAME, ADMIN_EMAIL); every member field is `null`,
 * `personalEmail`, `birthDate` and `phone` included, and so is `lastLoginAt` before the second login.
 */
export function buildSeedProfile(): MyProfileResponseDto {
  return {
    name: "Marina Albuquerque",
    ra: "a0000001",
    role: Role.coordinator,
    accessEnabled: true,
    birthDate: null,
    phone: null,
    email: "marina.albuquerque@example.com",
    personalEmail: null,
    address: null,
    city: null,
    state: null,
    institutionalEmail: null,
    course: null,
    semester: null,
    className: null,
    volunteerTermUrl: null,
    mainFunction: null,
    department: null,
    joinedAt: null,
    cpfMasked: null,
    lastLoginAt: null,
  };
}

interface MyProfileHandlerOptions {
  profile?: MyProfileResponseDto;
  /** Answers with the `ApiErrorDto` shape and this status instead of the profile. */
  error?: { statusCode: number; error: string; message?: string };
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  onCall?: () => void;
}

export function myProfileHandler({
  profile = buildMyProfile(),
  error,
  delay,
  onCall,
}: MyProfileHandlerOptions = {}) {
  return http.get("*/members/me", async () => {
    onCall?.();
    if (delay) await delay;

    if (error) {
      return HttpResponse.json(
        { statusCode: error.statusCode, error: error.error, message: error.message ?? error.error },
        { status: error.statusCode },
      );
    }
    return HttpResponse.json(profile);
  });
}
