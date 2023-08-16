import * as vscode from 'vscode';
import * as fs from 'fs';

import {
  findNearestPackageJson,
  checkDependency,
} from './utils';

interface ICacheMemory {
  [key: string]: {
    options: Array<any>;
    components: Array<string>;
  };
}
class MaterialUICompletionItem extends vscode.CompletionItem {
  components?: string[];
  icons?: string[];
}

const cacheMemory: ICacheMemory = {};
let currentPkgApp: string = '';
let currentPkgAppPath: string = '';
let bifrostVersion: string = '';
let folderChanged: boolean = false;
let currentFilePath: string = '';
let LIST_OF_COMPONENTS: Array<string> = [];

const onReload = () => {
  let activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    let nearestPackageJson: Array<string> | null = findNearestPackageJson(
      activeEditor.document.uri.fsPath
    );

    if (nearestPackageJson && nearestPackageJson.length === 3) {
      const getBifrostVersion = checkDependency(
        nearestPackageJson[0],
        '@browserstack/bifrost'
      );

      if (getBifrostVersion) {
        bifrostVersion = getBifrostVersion;
      }

      currentPkgApp = nearestPackageJson[2];

      currentPkgAppPath = nearestPackageJson[1];

      if (
        cacheMemory[bifrostVersion] ||
        cacheMemory[bifrostVersion]?.options?.length
      ) {
        console.log('Cached entry reload...');
        LIST_OF_COMPONENTS = cacheMemory[bifrostVersion]?.components;
      } else {
        console.log('Fresh entry reload...');
        const rawData = fs.readFileSync(
          currentPkgAppPath +
            '/node_modules/@browserstack/bifrost/dist/snippets.json'
        ) as any;

        const snippets = JSON.parse(rawData);

        !(bifrostVersion in cacheMemory) &&
          (cacheMemory[bifrostVersion] = {
            options: [],
            components: [],
          });

        const props = getPropsList(snippets);
            const list = Object.keys(props);
            LIST_OF_COMPONENTS = list;
            cacheMemory[bifrostVersion].components = list;
            cacheMemory[bifrostVersion].meta = props;
      }
    }
  }
};


const getPropsList = (snips) => {
  const propList = {};

  for (const componentPath in snips) {
    if (snips.hasOwnProperty(componentPath)) {
      const componentInfo = snips[componentPath][0];
      const componentName = componentInfo.displayName;
      const componentProps = componentInfo.props;

      const propsArray = [];

      for (const propName in componentProps) {
        if (componentProps.hasOwnProperty(propName)) {
          const propType = componentProps[propName].type.name;
          const description = componentProps[propName].description;
          propsArray.push({ name: propName, type: propType, description });
        }
      }

      propList[componentName] = { component: componentName, props: propsArray };
    }
  }
  return propList;
};

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
      LIST_OF_COMPONENTS.includes(componentName)
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
      return `- **${prop.name}** (${prop.type}) ${
        prop.description ? ': ' + prop.description : ''
      }`;
    };

    const props = cacheMemory[bifrostVersion].meta[hoveredWord];

    const tooltipContent = new vscode.MarkdownString(
      `import { ${hoveredWord} } from "@browserstack/bifrost";\n\n${hoveredWord} : description\n\nProps:\n${props.props
        .map(formatProp)
        .join(
          '\n'
        )}\n\n[Open Documentation](https://master--63a3f85277e81b426be0fdf8.chromatic.com/?path=/story/application-components-badge--primary)`
    );

    return new vscode.Hover(tooltipContent);
  }
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // on reload of extension
  onReload();

  // on any file change
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      currentFilePath = editor.document.fileName;
      let activeEditor = vscode.window.activeTextEditor;

      if (activeEditor && !currentFilePath.includes(currentPkgApp)) {
        console.log('Folder changed!!');
        folderChanged = true;
        let nearestPackageJson: Array<string> | null = findNearestPackageJson(
          activeEditor.document.uri.fsPath
        );

        if (nearestPackageJson && nearestPackageJson.length === 3) {
          const getBifrostVersion = checkDependency(
            nearestPackageJson[0],
            '@browserstack/bifrost'
          );

          if (getBifrostVersion) {
            bifrostVersion = getBifrostVersion;
          }

          currentPkgApp = nearestPackageJson[2];

          currentPkgAppPath = nearestPackageJson[1];

          if (
            cacheMemory[bifrostVersion] ||
            cacheMemory[bifrostVersion]?.options?.length
          ) {
            console.log('Cached entry change...');
            LIST_OF_COMPONENTS = cacheMemory[bifrostVersion]?.components;
          } else {
            console.log('Fresh entry change...');

            const rawData = fs.readFileSync(
              currentPkgAppPath +
                '/node_modules/@browserstack/bifrost/dist/snippets.json'
            ) as any;

            const snippets = JSON.parse(rawData);

            !(bifrostVersion in cacheMemory) &&
              (cacheMemory[bifrostVersion] = {
                options: [],
                components: [],
              });

            const props = getPropsList(snippets);
            const list = Object.keys(props);
            LIST_OF_COMPONENTS = list;
            cacheMemory[bifrostVersion].components = list;
            cacheMemory[bifrostVersion].meta = props;
          }
        }
      } else {
        folderChanged = false;
      }
    }
  });

  for (const language of ['javascript', 'javascriptreact', 'typescriptreact']) {
    let lastOptions = null;

    const getCompletionItems = (options: any): MaterialUICompletionItem[] => {
      lastOptions = options;
      const result = [];

      if (
        cacheMemory[bifrostVersion] &&
        cacheMemory[bifrostVersion].options.length
      ) {
        console.log('picked from cache!!');
        return cacheMemory[bifrostVersion].options;
      }

      const rawData = fs.readFileSync(
        currentPkgAppPath +
          '/node_modules/@browserstack/bifrost/dist/snippets.json'
      ) as any; // TODO: type annote

      const snippets = JSON.parse(rawData);

      for (const key in snippets) {
        if (snippets.hasOwnProperty(key)) {
          const { displayName, description } = snippets[key][0];
          const body = `<${displayName}>{$1}</${displayName}>`;
          const completion = new MaterialUICompletionItem('bi' + displayName);
          completion.insertText = new vscode.SnippetString(body);
          completion.documentation = new vscode.MarkdownString(description);
          completion.components = [];
          result.push(completion);
        }
      }

      !(bifrostVersion in cacheMemory) &&
        (cacheMemory[bifrostVersion] = {
          options: [],
          components: [],
        });

      cacheMemory[bifrostVersion].options = result;

      return result;
    };

    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(language, {
        provideCompletionItems(): vscode.ProviderResult<
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
    vscode.languages.registerHoverProvider('javascriptreact', {
      provideHover,
    })
  );
}
