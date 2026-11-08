// Client-safe definitions for the Personal page (profile fields and document categories).
import { z } from "zod";

const s = (max = 200) => z.string().trim().max(max).optional().default("");

export const profileSchema = z.object({
  fullName: s(),
  preferredName: s(),
  dateOfBirth: s(10),
  gender: s(40),
  nationality: s(80),
  phone: s(40),
  email: s(),
  address: s(500),
  nicNumber: s(40),
  passportNumber: s(40),
  passportExpiry: s(10),
  drivingLicenseNumber: s(40),
  drivingLicenseExpiry: s(10),
  taxId: s(40),
  bloodType: s(5),
  heightCm: s(10),
  weightKg: s(10),
  allergies: s(1000),
  medications: s(1000),
  conditions: s(1000),
  doctorName: s(),
  doctorPhone: s(40),
  insuranceProvider: s(),
  insurancePolicy: s(80),
  emergencyContacts: z
    .array(z.object({ name: s(), relation: s(60), phone: s(40) }))
    .max(10)
    .optional()
    .default([]),
  custom: z
    .array(z.object({ label: s(80), value: s(1000) }))
    .max(50)
    .optional()
    .default([]),
});

export type Profile = z.output<typeof profileSchema>;

export function parseProfile(raw: unknown): Profile {
  const r = profileSchema.safeParse(raw ?? {});
  return r.success ? r.data : profileSchema.parse({});
}

type Field = { key: keyof Profile; label: string; type?: "date" | "textarea" | "select"; options?: string[]; secret?: boolean };

export const PROFILE_SECTIONS: { title: string; sub: string; fields: Field[] }[] = [
  {
    title: "Basic details",
    sub: "Who you are and how to reach you",
    fields: [
      { key: "fullName", label: "Full name" },
      { key: "preferredName", label: "Preferred name" },
      { key: "dateOfBirth", label: "Date of birth", type: "date" },
      { key: "gender", label: "Gender" },
      { key: "nationality", label: "Nationality" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address", type: "textarea" },
    ],
  },
  {
    title: "Identity numbers",
    sub: "Hidden by default. Tap the eye to reveal.",
    fields: [
      { key: "nicNumber", label: "National ID (NIC)", secret: true },
      { key: "passportNumber", label: "Passport number", secret: true },
      { key: "passportExpiry", label: "Passport expiry", type: "date" },
      { key: "drivingLicenseNumber", label: "Driving licence number", secret: true },
      { key: "drivingLicenseExpiry", label: "Driving licence expiry", type: "date" },
      { key: "taxId", label: "Tax ID (TIN)", secret: true },
    ],
  },
  {
    title: "Health",
    sub: "Useful in an emergency",
    fields: [
      { key: "bloodType", label: "Blood type", type: "select", options: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      { key: "heightCm", label: "Height (cm)" },
      { key: "weightKg", label: "Weight (kg)" },
      { key: "allergies", label: "Allergies", type: "textarea" },
      { key: "medications", label: "Medications", type: "textarea" },
      { key: "conditions", label: "Medical conditions", type: "textarea" },
      { key: "doctorName", label: "Doctor" },
      { key: "doctorPhone", label: "Doctor's phone" },
      { key: "insuranceProvider", label: "Insurance provider" },
      { key: "insurancePolicy", label: "Policy number", secret: true },
    ],
  },
];

export const DOCUMENT_CATEGORIES = ["Identity", "Passport & travel", "Medical", "Education", "Work", "Finance", "Insurance", "Vehicle", "Property", "Other"];

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // keeps uploads under typical serverless body limits

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
