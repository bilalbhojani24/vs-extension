import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Path from 'path';

const propsArray = [
  { name: 'label', description: 'The label for the button', value: 'string' },
  {
    name: 'color',
    description: 'The color of the button',
    value: 'string',
    options: ['primary', 'secondary', 'default'],
  },
  {
    name: 'disabled',
    description: 'Whether the button is disabled',
    value: 'boolean',
  },
  {
    name: 'options',
    description: 'Available options',
    value: 'array',
    options: ['option1', 'option2', 'option3'],
  },
];

function isComponentImportedFromLibrary(document, componentName) {
  const text = document.getText();
  const importStatementRegex =
    /import\s*{[^}]*}\s*from\s*['"]@browserstack\/bifrost['"]/g;
  const matches = text.match(importStatementRegex);

  if (!matches) {
    return false;
  }

  for (const match of matches) {
    if (
      match.includes(componentName) &&
      Object.keys(snippets).includes(componentName)
    ) {
      return true;
    }
  }

  return false;
}

function provideHover(document, position) {
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return;
  }

  const hoveredWord = document.getText(wordRange);

  if (isComponentImportedFromLibrary(document, hoveredWord)) {
    const formatProp = (prop) => {
      const propType = `[${prop.value}]`;
      const description = prop.description;
      const options = prop.options
        ? `\nOptions: ${prop.options
            .map((option) => `**${option}**`)
            .join(', ')}`
        : '';

      return `- **${prop.name}** ${propType} : ${description}${options}`;
    };

    const tooltipContent = new vscode.MarkdownString(
      `${hoveredWord} : description\n\nProps:\n${propsArray
        .map(formatProp)
        .join(
          '\n'
        )}\n\n[Open Documentation](https://master--63a3f85277e81b426be0fdf8.chromatic.com/?path=/story/application-components-badge--primary)`
    );

    return new vscode.Hover(tooltipContent);
  }
}

class MaterialUICompletionItem extends vscode.CompletionItem {
  components?: string[];
  icons?: string[];
}

function getCurrentFilePath() {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor) {
    return activeTextEditor.document.uri.fsPath;
  }
  return null;
}

function getWorkspacePaths() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    return workspaceFolders.map((folder) => folder.uri.fsPath);
  }
  return [];
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log(__dirname);
  const rawData = fs.readFileSync(__dirname + '/output.json');

  const snippets = JSON.parse(rawData);

  let lastFolder = null;
  let currentFolderName = null;

  if (getCurrentFilePath()?.includes('growth-demo-app')) {
    currentFolderName = 'growth-demo';
    lastFolder = 'growth-demo';
  } else {
    currentFolderName = 'other';
  }

  for (const language of ['javascript', 'javascriptreact', 'typescriptreact']) {
    let lastOptions = null;
    let lastCompletionItems: MaterialUICompletionItem[] = [];

    const getCompletionItems = (options: any): MaterialUICompletionItem[] => {
      const currentFolderPath = getCurrentFilePath();

      if (currentFolderPath?.includes('growth-demo-app')) {
        currentFolderName = 'growth-demo';
      } else if (currentFolderPath?.includes('tcm')) {
        currentFolderName = 'tcm';
      } else {
        currentFolderName = 'other';
      }

      if (lastFolder === currentFolderName && lastCompletionItems.length) {
        return lastCompletionItems;
      } else {
        console.log('diff');
        lastFolder = currentFolderName;
      }
      // if (shallowEqual(options, lastOptions)) {
      //   return lastCompletionItems;
      // }
      lastOptions = options;
      const result = [];
      for (const key in snippets) {
        if (snippets.hasOwnProperty(key)) {
          console.count('key');
          const { displayName, prefix, description, body } = snippets[key][0];
          // const { text, components, icons } = createSnippet(snippet, options);
          const completion = new MaterialUICompletionItem('bi' + displayName);
          completion.insertText = new vscode.SnippetString(body);
          completion.documentation = new vscode.MarkdownString(description);
          completion.components = ['I am component', '2'];
          // completion.icons = icons;
          result.push(completion);
        }
      }
      // for (const snippet of Object.values(snippets)) {
      //   console.log(snippet);
      //   const { displayName,prefix, description, body } = snippet;
      //   // const { text, components, icons } = createSnippet(snippet, options);
      //   const completion = new MaterialUICompletionItem("bi" + displayName);
      //   completion.insertText = new vscode.SnippetString(body);
      //   completion.documentation = new vscode.MarkdownString(description);
      //   completion.components = ['I am component', '2'];
      //   // completion.icons = icons;
      //   result.push(completion);
      // }
      return (lastCompletionItems = result);
    };

    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(language, {
        provideCompletionItems(
          /* eslint-disable @typescript-eslint/no-unused-vars */
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
          context: vscode.CompletionContext
          /* eslint-enable @typescript-eslint/no-unused-vars */
        ): vscode.ProviderResult<
          | MaterialUICompletionItem[]
          | vscode.CompletionList<MaterialUICompletionItem>
        > {
          return getCompletionItems({
            language: language as any,
          });
        },
      })
    );
  }

  context.subscriptions.push(
    vscode.languages.registerHoverProvider('javascript', { provideHover })
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('javascriptreact', { provideHover })
  );
}
