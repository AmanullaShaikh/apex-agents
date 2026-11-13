import { test, describe } from 'node:test';
import assert from 'node:assert';
import { compactSourceCode } from '../scripts/compact-context.js';

describe('Babel AST Context Compactor', () => {
  test('should preserve TypeScript interfaces and exports', () => {
    const input = `
      export interface User {
        id: string;
        name: string;
      }
      export type Role = 'admin' | 'user';
    `;
    const result = compactSourceCode(input);
    assert.match(result, /interface User/);
    assert.match(result, /type Role/);
  });

  test('should strip internal method bodies down to {}', () => {
    const input = `
      export class OrderService {
        async process(orderId: string): Promise<boolean> {
          const db = await connect();
          console.log("Processing order", orderId);
          await db.save(orderId);
          return true;
        }
      }
    `;
    const result = compactSourceCode(input);
    assert.match(result, /class OrderService/);
    assert.match(result, /process\(orderId: string\): Promise<boolean>/);
    assert.doesNotMatch(result, /console\.log/);
    assert.doesNotMatch(result, /await db\.save/);
  });

  test('should compact React functional components cleanly', () => {
    const input = `
      import React, { useState } from 'react';
      export const Card: React.FC<{ title: string }> = ({ title }) => {
        const [open, setOpen] = useState(false);
        return <div>{title}</div>;
      };
    `;
    const result = compactSourceCode(input);
    assert.match(result, /export const Card/);
    assert.doesNotMatch(result, /<div>/);
    assert.doesNotMatch(result, /useState\(false\)/);
  });

  test('should gracefully handle empty or invalid input without crashing', () => {
    assert.strictEqual(compactSourceCode(''), '');
    const invalid = 'function incomplete(';
    const fallback = compactSourceCode(invalid);
    assert.strictEqual(typeof fallback, 'string');
  });
});
