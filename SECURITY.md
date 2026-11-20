# Security Policy

## Supported Versions

Security updates and patches are actively maintained for the current release line:

| Version | Supported |
| :--- | :--- |
| `3.x` | Yes |
| `< 3.0.0` | No (Deprecated) |

## Reporting a Vulnerability

Please **do NOT** open public GitHub issues for security vulnerabilities (such as command injection, path traversal, MCP server escapes, or secret-scanner bypasses).

1. **Email:** Send a detailed report to **[businessamanulla@gmail.com](mailto:businessamanulla@gmail.com)** with the subject `[SECURITY] Aveyx: <short summary>`.
2. **Include:**
   - Exact commit SHA or npm package version
   - Step-by-step reproduction script or diff payload
   - Expected vs. actual behavior and potential impact
3. **Response Timeline:**
   - Acknowledgment within **48 hours**
   - Triage and severity assessment within **5 business days**
   - Coordinated fix and release before public disclosure

## Security Design Boundaries

- **Offline-First:** Aveyx never transmits source code, diffs, or credentials over the network and never requires cloud API keys.
- **Workspace Containment:** MCP tools (`aveyx_trace_symbol`, `aveyx_impact_radius`) and CLI analyzers enforce workspace boundary checks against path traversal.
- **Untrusted Code:** Aveyx performs static AST parsing (`@babel/parser`) without executing target repository code (`test-loop` and `install-hooks` execute user-configured commands/hooks locally).
