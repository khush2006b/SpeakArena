/**
 * @group utils
 * @coverage 100%
 *
 * Unit tests for src/utils/validate.ts
 * Pure Zod schemas and file validation logic.
 */

import {
  emailSchema,
  passwordSchema,
  fullNameSchema,
  phoneSchema,
  urlSchema,
  otpSchema,
  courseTitleSchema,
  courseDescriptionSchema,
  priceSchema,
  MAX_VIDEO_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_PDF_TYPES,
  ALLOWED_IMAGE_TYPES,
  validateFile,
} from "@/utils/validate";

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------

describe("emailSchema", () => {
  it("accepts valid email addresses", () => {
    const validEmails = [
      "user@example.com",
      "user+tag@domain.co.uk",
      "UPPER@EXAMPLE.COM",
    ];
    validEmails.forEach((email) => {
      expect(emailSchema.safeParse(email).success).toBe(true);
    });
  });

  it("lowercases the email", () => {
    const result = emailSchema.safeParse("USER@EXAMPLE.COM");
    expect(result.success && result.data).toBe("user@example.com");
  });

  it("rejects an empty string", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Email is required");
  });

  it("rejects a string without @", () => {
    expect(emailSchema.safeParse("notanemail").success).toBe(false);
  });

  it("rejects a string without domain", () => {
    expect(emailSchema.safeParse("user@").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("MyPass123").success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = passwordSchema.safeParse("Ab1");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("rejects password without uppercase letter", () => {
    const result = passwordSchema.safeParse("mypass123");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/uppercase/i);
  });

  it("rejects password without a number", () => {
    const result = passwordSchema.safeParse("MyPassword");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/number/i);
  });
});

// ---------------------------------------------------------------------------
// fullNameSchema
// ---------------------------------------------------------------------------

describe("fullNameSchema", () => {
  it("accepts a valid name", () => {
    expect(fullNameSchema.safeParse("Alice Smith").success).toBe(true);
  });

  it("accepts names with hyphens and apostrophes", () => {
    expect(fullNameSchema.safeParse("O'Brien-Smith").success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(fullNameSchema.safeParse("A").success).toBe(false);
  });

  it("rejects a name with numbers", () => {
    expect(fullNameSchema.safeParse("Alice123").success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(fullNameSchema.safeParse("A".repeat(101)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// phoneSchema
// ---------------------------------------------------------------------------

describe("phoneSchema", () => {
  it("accepts a standard 10-digit phone number", () => {
    expect(phoneSchema.safeParse("9876543210").success).toBe(true);
  });

  it("accepts an international number with + prefix", () => {
    expect(phoneSchema.safeParse("+919876543210").success).toBe(true);
  });

  it("rejects a number shorter than 10 digits", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });

  it("rejects a number with letters", () => {
    expect(phoneSchema.safeParse("98765abc10").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// urlSchema
// ---------------------------------------------------------------------------

describe("urlSchema", () => {
  it("accepts a valid https URL", () => {
    expect(urlSchema.safeParse("https://example.com").success).toBe(true);
  });

  it("accepts an empty string", () => {
    expect(urlSchema.safeParse("").success).toBe(true);
  });

  it("accepts undefined", () => {
    expect(urlSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects a non-URL string", () => {
    expect(urlSchema.safeParse("not-a-url").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// otpSchema
// ---------------------------------------------------------------------------

describe("otpSchema", () => {
  it("accepts a 6-digit OTP", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
  });

  it("rejects a 5-digit OTP", () => {
    expect(otpSchema.safeParse("12345").success).toBe(false);
  });

  it("rejects an OTP with letters", () => {
    expect(otpSchema.safeParse("12345A").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// courseTitleSchema
// ---------------------------------------------------------------------------

describe("courseTitleSchema", () => {
  it("accepts a valid title between 5 and 200 characters", () => {
    expect(courseTitleSchema.safeParse("Advanced System Design").success).toBe(true);
  });

  it("rejects a title shorter than 5 characters", () => {
    expect(courseTitleSchema.safeParse("Hi").success).toBe(false);
  });

  it("rejects a title longer than 200 characters", () => {
    expect(courseTitleSchema.safeParse("A".repeat(201)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// priceSchema
// ---------------------------------------------------------------------------

describe("priceSchema", () => {
  it("accepts zero (free course)", () => {
    expect(priceSchema.safeParse(0).success).toBe(true);
  });

  it("accepts a positive price", () => {
    expect(priceSchema.safeParse(49900).success).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(priceSchema.safeParse(-100).success).toBe(false);
  });

  it("rejects a price over 1,000,000", () => {
    expect(priceSchema.safeParse(1_000_001).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateFile()
// ---------------------------------------------------------------------------

const makeFile = (name: string, type: string, size: number): File =>
  new File(["x".repeat(size)], name, { type });

describe("validateFile()", () => {
  describe("video files", () => {
    it("returns null for a valid MP4 under the size limit", () => {
      const file = makeFile("video.mp4", "video/mp4", 1024 * 1024); // 1MB
      expect(
        validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES)
      ).toBeNull();
    });

    it("returns an error for an unsupported video type", () => {
      const file = makeFile("video.avi", "video/avi", 1024 * 1024);
      const error = validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES);
      expect(error).toMatch(/not supported/i);
    });

    it("returns an error for a video exceeding 2GB", () => {
      const file = makeFile("video.mp4", "video/mp4", MAX_VIDEO_SIZE_BYTES + 1);
      const error = validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES);
      expect(error).toMatch(/too large/i);
      expect(error).toMatch(/2048MB/);
    });
  });

  describe("PDF files", () => {
    it("returns null for a valid PDF under the size limit", () => {
      const file = makeFile("doc.pdf", "application/pdf", 1024 * 1024); // 1MB
      expect(
        validateFile(file, ALLOWED_PDF_TYPES, MAX_PDF_SIZE_BYTES)
      ).toBeNull();
    });

    it("returns an error for a PDF exceeding 50MB", () => {
      const file = makeFile("doc.pdf", "application/pdf", MAX_PDF_SIZE_BYTES + 1);
      const error = validateFile(file, ALLOWED_PDF_TYPES, MAX_PDF_SIZE_BYTES);
      expect(error).toMatch(/50MB/);
    });
  });

  describe("image files", () => {
    it("returns null for a valid JPEG under the size limit", () => {
      const file = makeFile("avatar.jpg", "image/jpeg", 1024 * 1024); // 1MB
      expect(
        validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES)
      ).toBeNull();
    });

    it("returns an error for an unsupported image type (BMP)", () => {
      const file = makeFile("img.bmp", "image/bmp", 100);
      expect(
        validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES)
      ).toMatch(/not supported/i);
    });
  });
});
