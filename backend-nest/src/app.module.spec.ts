import { describe, it, expect, afterEach } from 'bun:test';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  let moduleBuilder: TestingModuleBuilder;

  afterEach(async () => {
    moduleBuilder = undefined as unknown as TestingModuleBuilder;
  });

  it('should compile the module (detects missing DI providers)', async () => {
    moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    const module = await moduleBuilder.compile();

    expect(module).toBeDefined();

    await module.close();
  });
});
