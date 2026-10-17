// Loadstar's file-structure rules (docs/design/conventions.md, "File structure"):
// - no `switch`: branch through a mapped object instead;
// - a `.tsx` file holds one component and nothing else at the top level but
//   its imports and, at most, its one type;
// - a file declares at most one type; two or more go into the folder's
//   `types.ts`.

const isPascalCase = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name)

const isFunctionLike = (node) =>
  node?.type === 'ArrowFunctionExpression' ||
  node?.type === 'FunctionExpression' ||
  // memo(() => …), forwardRef(…)
  (node?.type === 'CallExpression' &&
    node.arguments.some(
      (argument) =>
        argument.type === 'ArrowFunctionExpression' ||
        argument.type === 'FunctionExpression'
    ))

/** The statement itself, or the declaration an `export` wraps. */
const unwrapExport = (statement) =>
  statement.type === 'ExportNamedDeclaration' && statement.declaration
    ? statement.declaration
    : statement

/** Top-level `const Name = (…) => …` declarators whose name is PascalCase. */
const componentDeclarators = (program) =>
  program.body.flatMap((statement) => {
    const declaration = unwrapExport(statement)
    if (declaration.type !== 'VariableDeclaration') return []
    return declaration.declarations.filter(
      (declarator) =>
        declarator.id.type === 'Identifier' &&
        isPascalCase(declarator.id.name) &&
        isFunctionLike(declarator.init)
    )
  })

const isTypeDeclaration = (node) =>
  node.type === 'TSTypeAliasDeclaration' ||
  node.type === 'TSInterfaceDeclaration'

const fileName = (context) =>
  (context.filename ?? context.getFilename()).split(/[\\/]/).pop() ?? ''

const isTestFile = (name) => /\.test\.tsx?$/.test(name)

const noSwitch = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Branch through a mapped object, not a switch' },
    messages: {
      noSwitch:
        'Use a mapped object (Record<Kind, …> with `satisfies`) instead of a switch.'
    },
    schema: []
  },
  create: (context) => ({
    SwitchStatement: (node) => context.report({ node, messageId: 'noSwitch' })
  })
}

const componentFile = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'A .tsx file holds one component, its imports and at most its one type'
    },
    messages: {
      oneComponent:
        'One component per file: move `{{name}}` into its own file in the same `components/` folder.',
      onlyComponent:
        'A component file holds only the component (and at most its one type): move this into constants.ts, a hook or a utils file.'
    },
    schema: []
  },
  create: (context) => ({
    Program: (program) => {
      const name = fileName(context)
      if (!name.endsWith('.tsx') || isTestFile(name)) return
      const components = componentDeclarators(program)
      if (components.length === 0) return
      for (const extra of components.slice(1))
        context.report({
          node: extra,
          messageId: 'oneComponent',
          data: { name: extra.id.name }
        })
      const [component] = components
      for (const statement of program.body) {
        const declaration = unwrapExport(statement)
        const isAllowed =
          declaration.type === 'ImportDeclaration' ||
          isTypeDeclaration(declaration) ||
          (declaration.type === 'VariableDeclaration' &&
            declaration.declarations.every((declarator) =>
              components.includes(declarator)
            )) ||
          (statement.type === 'ExportNamedDeclaration' &&
            !statement.declaration) ||
          statement.type === 'ExportDefaultDeclaration'
        if (!isAllowed && component)
          context.report({ node: statement, messageId: 'onlyComponent' })
      }
    }
  })
}

const oneTypePerFile = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'At most one type per file; more go into the folder’s types.ts'
    },
    messages: {
      moveTypes:
        'This file declares more than one type: move its types into the folder’s types.ts.'
    },
    schema: []
  },
  create: (context) => ({
    Program: (program) => {
      const name = fileName(context)
      if (name === 'types.ts' || name.endsWith('.d.ts') || isTestFile(name))
        return
      const types = program.body.map(unwrapExport).filter(isTypeDeclaration)
      for (const extra of types.slice(1))
        context.report({ node: extra, messageId: 'moveTypes' })
    }
  })
}

export const structure = {
  meta: { name: '@loadstar/structure' },
  rules: {
    'no-switch': noSwitch,
    'component-file': componentFile,
    'one-type-per-file': oneTypePerFile
  }
}
