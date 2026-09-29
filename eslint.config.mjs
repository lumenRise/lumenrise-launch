import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const importLayoutRule = {
  meta: {
    type: 'layout',
    schema: [],
    messages: {
      externalFirst: 'Library imports must appear before local imports.',
      groupSpacing: 'Separate library imports from local imports with one blank line.',
      lengthOrder: 'Sort imports from the shortest statement to the longest statement.',
      afterImports: 'Separate the final import from the next statement with one blank line.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program(node) {
        const imports = node.body.filter((statement) => statement.type === 'ImportDeclaration');
        let localImportFound = false;

        for (let index = 0; index < imports.length; index += 1) {
          const currentImport = imports[index];
          const previousImport = imports[index - 1];
          const isLocal = currentImport.source.value.startsWith('.');

          if (!isLocal && localImportFound) {
            context.report({ node: currentImport, messageId: 'externalFirst' });
          }

          if (isLocal) {
            localImportFound = true;
          }

          if (!previousImport) {
            continue;
          }

          const previousIsLocal = previousImport.source.value.startsWith('.');

          if (isLocal !== previousIsLocal) {
            if (currentImport.loc.start.line - previousImport.loc.end.line !== 2) {
              context.report({ node: currentImport, messageId: 'groupSpacing' });
            }

            continue;
          }

          const currentLength = sourceCode.getText(currentImport).length;
          const previousLength = sourceCode.getText(previousImport).length;

          if (currentLength < previousLength) {
            context.report({ node: currentImport, messageId: 'lengthOrder' });
          }
        }

        const lastImport = imports.at(-1);
        const nextStatement = node.body.find((statement) => lastImport && statement.range[0] >= lastImport.range[1]);

        if (lastImport && nextStatement) {
          const gap = sourceCode.text.slice(lastImport.range[1], nextStatement.range[0]);

          if (/^\s+$/.test(gap) && nextStatement.loc.start.line - lastImport.loc.end.line !== 2) {
            context.report({ node: nextStatement, messageId: 'afterImports' });
          }
        }
      },
    };
  },
};

const singleFunctionFileRule = {
  meta: {
    type: 'layout',
    schema: [],
    messages: {
      multiple: 'Keep each top-level function in its own file.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const functions = node.body.filter(
          (statement) =>
            statement.type === 'FunctionDeclaration' ||
            (statement.type === 'VariableDeclaration' &&
              statement.declarations.some(
                (declaration) =>
                  declaration.init?.type === 'ArrowFunctionExpression' ||
                  declaration.init?.type === 'FunctionExpression',
              )),
        );

        for (const statement of functions.slice(1)) {
          context.report({ node: statement, messageId: 'multiple' });
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    'import-layout': importLayoutRule,
    'single-function-file': singleFunctionFileRule,
  },
};

export default tseslint.config(
  {
    ignores: ['coverage', 'dist', 'node_modules'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      curly: ['error', 'all'],
      'local/import-layout': 'error',
      'local/single-function-file': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
