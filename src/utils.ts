import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Path from 'path';

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
