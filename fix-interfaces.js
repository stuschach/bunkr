const fs = require('fs');
const glob = require('glob');

// Find all TS/TSX files
const files = glob.sync('src/**/*.{ts,tsx}');

let fixedFiles = 0;
let fixedIssues = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Match empty interfaces
  const emptyInterfaceRegex = /interface\s+(\w+)\s+extends\s+([^\{]+)\s*\{\s*\}/g;
  const matches = [...content.matchAll(emptyInterfaceRegex)];
  
  if (matches.length === 0) return;
  
  let newContent = content;
  matches.forEach(match => {
    const interfaceName = match[1];
    const superType = match[2].trim();
    
    // Replace with type alias
    const replacement = `type ${interfaceName} = ${superType};`;
    newContent = newContent.replace(match[0], replacement);
    fixedIssues++;
  });
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    fixedFiles++;
  }
});

console.log(`Fixed ${fixedIssues} empty interfaces in ${fixedFiles} files`);