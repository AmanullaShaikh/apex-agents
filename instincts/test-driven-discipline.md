# Instinct: Test-Driven Discipline

## Principle
Code without tests is legacy code at inception. Critical business logic, API validation, and state transformations must be safeguarded with automated tests.

## Execution Rules
1. **Failing Test First:**
   - When fixing a bug, write a reproduction test that fails on the current buggy code first.
   - Run the test to confirm it reproduces the exact failure.
2. **Minimal Fix:**
   - Apply the precise code change that makes the reproduction test pass without regressing adjacent tests.
3. **Edge Case Coverage:**
   - Every input boundary must be tested: `null`, `undefined`, empty strings, zero, negative numbers, extreme arrays, and invalid payloads.
