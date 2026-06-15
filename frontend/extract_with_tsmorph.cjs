const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths('src/components/dashboard/**/*.tsx');
project.addSourceFilesAtPaths('src/components/dashboard/*.tsx');

const files = project.getSourceFiles();

const strings = new Set();

files.forEach(file => {
  file.getDescendantsOfKind(SyntaxKind.JsxText).forEach(node => {
    const text = node.getLiteralText().trim();
    if (text.length > 2 && /[a-zA-Z]/.test(text) && !text.includes('{') && !text.includes('=>') && !text.includes('&&')) {
      strings.add(text);
    }
  });

  file.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach(attr => {
    const init = attr.getInitializer();
    if (init && init.getKind() === SyntaxKind.StringLiteral) {
      const text = init.getLiteralText().trim();
      if (text.length > 2 && /[a-zA-Z]/.test(text) && !text.includes('border') && !text.includes('hover:') && !text.includes('text-')) {
        strings.add(text);
      }
    }
  });
});

const sortedStrings = Array.from(strings).sort();
fs.writeFileSync('extracted_ui_strings.json', JSON.stringify(sortedStrings, null, 2));
console.log(`Extracted ${sortedStrings.length} strings from ${files.length} files`);
