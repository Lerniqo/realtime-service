declare namespace jest {
  interface MockedFunction<T extends (...args: any[]) => any>
    extends jest.Mock<ReturnType<T>, Parameters<T>> {
    // Add a property to make this interface non-empty
    _isMocked: true;
  }

  type MockedObject<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any
      ? MockedFunction<T[K]>
      : T[K] extends object
        ? MockedObject<T[K]>
        : T[K];
  };
}

declare module '@nestjs/testing' {
  type FunctionType = (...args: any[]) => any;

  type ClassType<T = any> = new (...args: any[]) => T;

  interface TestingModule {
    get<TInput = any, TResult = TInput>(
      typeOrToken: string | symbol | FunctionType | ClassType<TInput>,
      options?: { strict: boolean },
    ): TResult;
    close(): Promise<void>;
  }

  interface TestingModuleBuilder {
    compile(): Promise<TestingModule>;
    overrideProvider(typeOrToken: any): {
      useValue(value: any): TestingModuleBuilder;
      useClass(metatype: any): TestingModuleBuilder;
      useFactory(options: any): TestingModuleBuilder;
    };
    overrideGuard(typeOrToken: any): {
      useValue(value: any): TestingModuleBuilder;
      useClass(metatype: any): TestingModuleBuilder;
    };
    overrideInterceptor(typeOrToken: any): {
      useValue(value: any): TestingModuleBuilder;
      useClass(metatype: any): TestingModuleBuilder;
    };
    overrideFilter(typeOrToken: any): {
      useValue(value: any): TestingModuleBuilder;
      useClass(metatype: any): TestingModuleBuilder;
    };
    overridePipe(typeOrToken: any): {
      useValue(value: any): TestingModuleBuilder;
      useClass(metatype: any): TestingModuleBuilder;
    };
  }

  export class Test {
    static createTestingModule(metadata: any): TestingModuleBuilder;
  }
}
