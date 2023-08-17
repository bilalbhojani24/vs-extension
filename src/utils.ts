import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Path from 'path';
import jscodeshift, { ImportDeclaration, ASTPath } from 'jscodeshift';
import { getParserSync } from 'babel-parse-wild-code';

export default function getExistingImports(document: vscode.TextDocument): {
  existingComponents: Set<string>;
  insertPosition: vscode.Position;
  coreInsertPosition: vscode.Position | null;
} {
  const text = document.getText();
  const parser = getParserSync(document.uri.fsPath, { tokens: true });
  const j = parser ? jscodeshift.withParser(parser) : jscodeshift;

  const components: Set<string> = new Set();

  let insertLine = 0;
  let coreInsertPosition: vscode.Position | null = null;

  let root;
  try {
    root = j(text);
  } catch (error) {
    // fall back to trying with flow parser, because it tends to be
    // very tolerant of errors and we might at least get the import
    // nodes
    root = j.withParser('flow')(text);
  }
  root
    .find(j.ImportDeclaration)
    .forEach(({ node }: ASTPath<ImportDeclaration>): void => {
      if (!node) {
        return;
      }
      if (node.loc) {
        insertLine = node.loc.end.line;
      }
      const source = node.source.value;
      if (typeof source !== 'string') {
        return;
      }

      if (node.specifiers && source === '@browserstack/bifrost') {
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            continue;
          }
          const { loc } = specifier;
          if (loc) {
            const { line, column } = loc.end;
            coreInsertPosition = new vscode.Position(line - 1, column);
          }
          const { imported, local } = specifier;
          if (imported && local && imported.name === local.name) {
            components.add(local.name);
          }
        }
      }
    });
  return {
    existingComponents: components,
    insertPosition: new vscode.Position(insertLine, 0),
    coreInsertPosition,
  };
}

export const getCurrentFilePath = () => {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor) {
    return activeTextEditor.document.uri.fsPath;
  }
  return null;
};

export const getWorkspacePaths = () => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    return workspaceFolders.map((folder) => folder.uri.fsPath);
  }
  return [];
};

export const findNearestPackageJson = (filePath: string) => {
  let currentDir = Path.dirname(filePath);

  while (currentDir !== '/') {
    const packageJsonPath = Path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      // also return currentDir
      const currentAppOrPkg = currentDir?.split('/') || [];

      return [
        packageJsonPath,
        currentDir,
        currentAppOrPkg[currentAppOrPkg.length - 1],
      ];
    }

    // Move up one directory level
    currentDir = Path.dirname(currentDir);
  }

  return null; // No package.json found
};

export const checkDependency = (
  packageJsonPath: string,
  dependencyName: string
) => {
  if (fs.existsSync(packageJsonPath)) {
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJsonData = JSON.parse(packageJsonContent);

    if (
      packageJsonData.dependencies &&
      packageJsonData.dependencies[dependencyName]
    ) {
      return `v${packageJsonData.dependencies[dependencyName]}`;
    }
  }

  return false;
};

export const onFileChange = () => {
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      return editor.document.fileName;
    }
  });
};
