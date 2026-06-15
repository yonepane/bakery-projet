const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
project.addSourceFilesAtPaths('src/components/dashboard/panels/*.tsx');

const filesToFix = [
  'InventoryPanel.tsx',
  'ExpensesPanel.tsx',
  'StaffPanel.tsx',
  'PurchasingPanel.tsx',
  'PlannerPanel.tsx',
  'CustomersPanel.tsx'
];

filesToFix.forEach(fileName => {
  const file = project.getSourceFileOrThrow(fileName);
  
  // 1. Add 't' to the Pick list
  const typeAlias = file.getTypeAlias('Props');
  if (typeAlias) {
    const typeNode = typeAlias.getTypeNode();
    if (typeNode && typeNode.getKind() === SyntaxKind.TypeReference) {
      const typeArgs = typeNode.getTypeArguments();
      if (typeArgs.length === 2 && typeArgs[1].getKind() === SyntaxKind.UnionType) {
        const unionType = typeArgs[1];
        if (!unionType.getText().includes("'t'")) {
           unionType.replaceWithText(`${unionType.getText()} | 't'`);
        }
      }
    }
  }

  // 2. Add 't' to the arrow function destructured params
  const arrowFunc = file.getDescendantsOfKind(SyntaxKind.ArrowFunction)[0];
  if (arrowFunc) {
    const params = arrowFunc.getParameters();
    if (params.length > 0) {
      const param = params[0];
      if (param.getNameNode().getKind() === SyntaxKind.ObjectBindingPattern) {
        const binding = param.getNameNode();
        if (!binding.getText().includes(' t')) {
          binding.addBinding({ name: 't' });
        }
      }
    }
  }
});

project.saveSync();
console.log('Fixed props in panels.');
