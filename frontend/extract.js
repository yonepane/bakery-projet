import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

const project = new Project();
project.addSourceFilesAtPaths("src/components/dashboard/panels/**/*.tsx");
project.addSourceFileAtPath("src/components/Dashboard.tsx");

const strings = new Set();
const ignoreAttributes = ['className', 'type', 'id', 'name', 'd', 'stroke', 'fill', 'viewBox', 'xmlns', 'dir', 'href', 'value', 'size', 'color', 'icon', 'role', 'htmlFor'];

for (const sourceFile of project.getSourceFiles()) {
  sourceFile.forEachDescendant(node => {
    // 1. JsxText
    if (node.getKind() === SyntaxKind.JsxText) {
      const text = node.getText().trim();
      if (text && text.match(/[a-zA-Z]/) && !text.includes('{') && !text.match(/^[0-9A-Z_]+$/) && text.length > 1) {
        strings.add(text);
      }
    }
    // 2. StringLiteral in JsxAttribute
    if (node.getKind() === SyntaxKind.StringLiteral) {
      const attr = node.getParentIfKind(SyntaxKind.JsxAttribute);
      if (attr) {
        const attrName = attr.getNameNode().getText();
        if (!ignoreAttributes.includes(attrName)) {
          const text = node.getLiteralValue().trim();
          if (text && text.match(/[a-zA-Z]/) && text.length > 1) {
            strings.add(text);
          }
        }
      }
    }
    // 3. StringLiteral in addToast
    if (node.getKind() === SyntaxKind.StringLiteral) {
        const callExpr = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
        if (callExpr && callExpr.getExpression().getText() === 'addToast') {
            const args = callExpr.getArguments();
            if (args.length > 0 && args[0] === node) {
                strings.add(node.getLiteralValue().trim());
            }
        }
    }
  });
}

const arr = Array.from(strings).sort();
fs.writeFileSync('extracted_strings.json', JSON.stringify(arr, null, 2));
console.log("Extracted " + arr.length + " strings to extracted_strings.json");
