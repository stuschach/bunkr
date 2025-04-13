const fs = require('fs');
const glob = require('glob');

// Find all TS/TSX files
const files = glob.sync('src/**/*.{ts,tsx}');

// Regular expressions for finding unused variables and imports
const unusedVarRegex = /(?:'|")([^'"]*)(?:'|") is (defined but never used|assigned a value but never used)/g;

let fixedFiles = 0;
let fixedIssues = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const errors = [...content.matchAll(unusedVarRegex)].map(match => match[1]);
  
  if (errors.length === 0) return;
  
  let newContent = content;
  
  errors.forEach(varName => {
    // Replace occurrences of the variable declaration
    const varRegex = new RegExp(`(const|let|var)\\s+(${varName})\\s*=`, 'g');
    newContent = newContent.replace(varRegex, `$1 _${varName} =`);
    
    // Replace function parameter
    const paramRegex = new RegExp(`\\((.*?)(${varName})(.*?)\\)`, 'g');
    newContent = newContent.replace(paramRegex, (match, before, param, after) => {
      // Check if it's a parameter and not something else
      if (before.includes('{') || after.includes('}')) return match;
      return `(${before}_${param}${after})`;
    });
    
    // Replace import statements
    const importRegex = new RegExp(`import\\s+\\{([^}]*)(${varName})([^}]*)\\}\\s+from`, 'g');
    newContent = newContent.replace(importRegex, (match, before, imp, after) => {
      return `import {${before}_${imp}${after}} from`;
    });
    
    fixedIssues++;
  });
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    fixedFiles++;
  }
});

console.log(`Fixed ${fixedIssues} unused variables/imports in ${fixedFiles} files`);