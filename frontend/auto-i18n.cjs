const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths('src/components/dashboard/**/*.tsx');
project.addSourceFilesAtPaths('src/components/Dashboard.tsx');

// List of strings to translate. We will only wrap these exactly, to avoid breaking logic.
const targetStrings = [
  "Dashboard", "Expenses", "Settings", "Staff Management", "Inventory", "Purchasing", 
  "POS Terminal", "Pre-Orders", "Financial Intelligence", "Kitchen", "Customers", "Analytics",
  "History", "Planner", "Track business overhead, bills, and payroll", "Log New Expense",
  "Date", "Category", "Description", "Amount", "No expenses logged yet", "Save Changes",
  "Bakery Identity", "Bakery Name", "Receipt Footer", "Financial Config", "Currency",
  "Tax Rate (%)", "UI Preferences", "Interface Language", "Theme Mode", "Switch to Light",
  "Switch to Dark", "Manage your bakery team and access credentials", "Username", "Role",
  "Actions", "No staff accounts created yet", "Total Revenue", "Net Profit", "Total Cost",
  "Add Item", "Status", "Pending", "Complete", "Delete", "Edit", "Add staff", "Staff", "Revenue:",
  "Total Cash Counted", "Shift Closed", "Close Shift / Reset Session", "Manage Order", "Finish Batch",
  "Live portfolio performance analysis", "Active Batch Queue", "Stock Levels Optimal", "New Entity",
  "No products found", "Supplier", "Volume Distribution", "Market Performance"
];

const files = project.getSourceFiles();

files.forEach(file => {
  let fileChanged = false;

  // 1. Wrap JSX Text
  file.getDescendantsOfKind(SyntaxKind.JsxText).forEach(node => {
    const text = node.getLiteralText().trim();
    if (targetStrings.includes(text)) {
      // Replace JSX Text `Text` with `{t("Text")}`
      node.replaceWithText(`{t("${text}")}`);
      fileChanged = true;
    }
  });

  // 2. Add useTranslation hook and import
  if (fileChanged) {
    const hasImport = file.getImportDeclarations().some(i => i.getModuleSpecifierValue() === 'react-i18next');
    if (!hasImport) {
      file.addImportDeclaration({
        namedImports: ['useTranslation'],
        moduleSpecifier: 'react-i18next'
      });
    }

    // Find the main functional component arrow function
    const components = file.getDescendantsOfKind(SyntaxKind.ArrowFunction);
    if (components.length > 0) {
      const comp = components[0];
      const body = comp.getBody();
      if (body && body.getKind() === SyntaxKind.Block) {
        // Only inject if not already there
        if (!body.getText().includes('useTranslation')) {
          body.insertStatements(0, "const { t } = useTranslation();");
        }
      }
    }
  }
});

project.saveSync();
console.log("Auto-i18n complete.");
