const fs = require('fs');
const glob = require('glob');

// Find all TSX files
const files = glob.sync('src/**/*.tsx');

// Replacements for unescaped entities
const replacements = {
  "'": "&apos;",
  '"': "&quot;"
};

let fixedFiles = 0;
let fixedIssues = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Simple approach to find potential JSX with unescaped entities
  // This is a simplified regex and may need refinement
  const jsxRegex = /<[^>]*>([^<]*?['"].*?['"][^<]*?)<\/[^>]*>/g;
  let matches = [...content.matchAll(jsxRegex)];
  
  if (matches.length === 0) return;
  
  let newContent = content;
  matches.forEach(match => {
    const text = match[1];
    let newText = text;
    
    // Replace unescaped entities
    for (const [entity, replacement] of Object.entries(replacements)) {
      // Avoid replacing entities that are already escaped
      const regex = new RegExp(`(?<!&[a-z]+;|&#[0-9]+;)${entity}`, 'g');
      newText = newText.replace(regex, replacement);
    }
    
    if (newText !== text) {
      newContent = newContent.replace(text, newText);
      fixedIssues++;
    }
  });
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    fixedFiles++;
  }
});

console.log(`Fixed ${fixedIssues} unescaped entities in ${fixedFiles} files`);