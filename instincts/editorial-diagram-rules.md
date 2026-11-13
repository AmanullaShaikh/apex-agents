# Editorial Architecture Diagram Discipline

Derived from Cathryn Lavery's *Diagram Design*: Professional, clean, editorial SVG and HTML architecture representations for coding agents.

## Anti-Mermaid Slop Principles:

1. **No Spaghetti Layouts**:
   - Default Mermaid diagrams frequently render ugly overlapping text, illegible diagonal arrows, and distorted line-wrapping.
   - For complex architectures, prefer clean, structured Markdown tables, indented hierarchical trees, or self-contained HTML/SVG cards.

2. **Visual Hierarchy & Contrast**:
   - Clearly delineate boundaries between Tiers (Client, Edge, Gateway, Service, Data Store).
   - Use standardized high-contrast color accents:
     - Blue / Cyan: Client & Ingress
     - Purple / Violet: Application Services
     - Amber / Yellow: Message Brokers / Event Buses
     - Emerald / Green: Primary Data Stores & Caches
     - Red / Rose: Security Boundaries & Firewalls

3. **Data Flow Clarity**:
   - Every connection must indicate protocol (HTTPS, gRPC, WSS, TCP) and payload semantics (Sync vs Async).
   - Label request/response directions unambiguously.
