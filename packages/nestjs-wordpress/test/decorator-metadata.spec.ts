import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

// Guards the toolchain, not the library: NestJS resolves constructor dependencies from
// `design:paramtypes` metadata. If the test transformer stops emitting it, DI silently
// injects `undefined`, so we fail fast here instead of in confusing service tests.
@Injectable()
class Dependency {
  readonly name = 'dependency';
}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

describe('test toolchain', () => {
  it('emits decorator metadata so Nest can inject constructor dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [Dependency, Consumer],
    }).compile();

    expect(moduleRef.get(Consumer).dependency.name).toBe('dependency');
  });
});
