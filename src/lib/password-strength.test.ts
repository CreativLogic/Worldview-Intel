/**
 * Tests for zxcvbn-ts password strength evaluation.
 *
 * Verifies:
 *  1. Empty password returns score 0
 *  2. Very weak passwords score below MIN_PASSWORD_SCORE
 *  3. Common passwords score below MIN_PASSWORD_SCORE
 *  4. Strong passphrases score >= 3
 *  5. Feedback string is provided for weak passwords
 */
import { describe, it, expect } from "vitest";
import { evaluatePasswordStrength, MIN_PASSWORD_SCORE } from "./password-strength";

describe("evaluatePasswordStrength", () => {
    it("returns score 0 for empty password", () => {
        const result = evaluatePasswordStrength("");
        expect(result.score).toBe(0);
    });

    it("returns score < MIN_PASSWORD_SCORE for a very weak password", () => {
        const result = evaluatePasswordStrength("abc123");
        expect(result.score).toBeLessThan(MIN_PASSWORD_SCORE);
    });

    it("returns score < MIN_PASSWORD_SCORE for a common password", () => {
        const result = evaluatePasswordStrength("password123");
        expect(result.score).toBeLessThan(MIN_PASSWORD_SCORE);
    });

    it("returns score >= 3 for a strong passphrase", () => {
        const result = evaluatePasswordStrength("CorrectHorseBatteryStaple!1");
        expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it("returns feedback string for weak passwords", () => {
        const result = evaluatePasswordStrength("123");
        expect(result.feedback.length).toBeGreaterThan(0);
    });
});
