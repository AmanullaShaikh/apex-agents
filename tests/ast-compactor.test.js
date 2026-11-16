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

  test('should annotate reverse callers when provided in options', () => {
    const input = `export function calculateTax(amount: number): number { return amount * 0.15; }`;
    const callers = {
      calculateTax: [{ file: 'src/checkout.ts', line: 42 }]
    };
    const result = compactSourceCode(input, { callers });
    assert.match(result, /🔗 Callers \(1\): src\/checkout\.ts:42/);
    assert.match(result, /calculateTax\(amount: number\): number/);
  });

  test('should compact Python code preserving def signatures and replacing bodies with pass', () => {
    const input = `
import os
class DataPipeline:
    def process_data(self, records: list) -> bool:
        for r in records:
            print("Processing", r)
        return True
    `;
    const result = compactSourceCode(input, { ext: 'py' });
    assert.match(result, /import os/);
    assert.match(result, /class DataPipeline:/);
    assert.match(result, /def process_data\(self, records: list\) -> bool:/);
    assert.match(result, /pass/);
    assert.doesNotMatch(result, /print\("Processing"/);
  });

  test('should compact Go and Rust code cleanly', () => {
    const goInput = `
package service
func ProcessOrder(id string) error {
    log.Println("Order", id)
    return nil
}
    `;
    const goResult = compactSourceCode(goInput, { ext: 'go' });
    assert.match(goResult, /package service/);
    assert.match(goResult, /func ProcessOrder\(id string\) error/);
    assert.doesNotMatch(goResult, /log\.Println/);

    const rsInput = `
use std::collections::HashMap;
pub fn calculate_hash(key: &str) -> u64 {
    let mut map = HashMap::new();
    map.insert(key, 1);
    42
}
    `;
    const rsResult = compactSourceCode(rsInput, { ext: 'rs' });
    assert.match(rsResult, /use std::collections::HashMap;/);
    assert.match(rsResult, /pub fn calculate_hash\(key: &str\) -> u64/);
    assert.doesNotMatch(rsResult, /HashMap::new/);

    // Verify Rust struct fields and impl method body stripping
    const rsStruct = `
pub struct Cache {
    map: HashMap<String, Value>,
    cap: usize,
}

impl Cache {
    pub(crate) fn get_val(&self, k: &str) -> Option<&Value> {
        let secret = 42;
        self.map.get(k)
    }
}
    `;
    const rsStructResult = compactSourceCode(rsStruct, { ext: 'rs' });
    assert.match(rsStructResult, /map: HashMap<String, Value>/);
    assert.match(rsStructResult, /cap: usize/);
    assert.match(rsStructResult, /pub\(crate\) fn get_val/);
    assert.doesNotMatch(rsStructResult, /secret = 42/);

    // Verify Go multiline imports and struct fields
    const goStruct = `
package main

import (
    "net/http"
    "fmt"
)

type Server struct {
    Addr string
    Port int
}

func (s *Server) Start() error {
    secret := 42
    return nil
}
    `;
    const goStructResult = compactSourceCode(goStruct, { ext: 'go' });
    assert.match(goStructResult, /"net\/http"/);
    assert.match(goStructResult, /Addr string/);
    assert.match(goStructResult, /Port int/);
    assert.doesNotMatch(goStructResult, /secret := 42/);

    // Verify single-line Rust impl method stripping (exact Claude benchmark case)
    const singleLineRust = 'impl Cache { pub(crate) fn get(&self, k: &str) -> Option<&Value> { let secret = 42; self.map.get(k) } }';
    const singleLineRustResult = compactSourceCode(singleLineRust, { ext: 'rs' });
    assert.match(singleLineRustResult, /impl Cache/);
    assert.match(singleLineRustResult, /pub\(crate\) fn get/);
    assert.match(singleLineRustResult, /\/\* stripped \*\//);
    assert.doesNotMatch(singleLineRustResult, /secret = 42/);
  });
});
