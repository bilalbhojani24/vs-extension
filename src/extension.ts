import * as vscode from 'vscode';
import * as fs from 'fs';

import getExistingImports, {
  findNearestPackageJson,
  checkDependency,
} from './utils';

interface ICacheMemory {
  [key: string]: {
    options: Array<any>;
    components: Array<string>;
    // TODO: Type update
    meta: any;
  };
}
class MaterialUICompletionItem extends vscode.CompletionItem {
  components?: string[];
  icons?: string[];
}

// const cacheMemory: ICacheMemory = {};
const cacheMemory = {} as ICacheMemory;
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

        currentPkgApp = nearestPackageJson[2];

        currentPkgAppPath = nearestPackageJson[1];

        if (
          cacheMemory[bifrostVersion] ||
          cacheMemory[bifrostVersion]?.options?.length
        ) {
          // console.log('Cached entry reload...');
          LIST_OF_COMPONENTS = cacheMemory[bifrostVersion]?.components;
        } else {
          // console.log('Fresh entry reload...');
          const fp =
            currentPkgAppPath +
            '/node_modules/@browserstack/bifrost/dist/snippets.json';
          if (fs.existsSync(fp)) {
            const rawData = fs.readFileSync(fp) as any;

            const snippets = JSON.parse(rawData);

            !(bifrostVersion in cacheMemory) &&
              (cacheMemory[bifrostVersion] = {
                options: [],
                components: [],
                meta: {},
              });

            const props = getPropsList(snippets);
            const list = Object.keys(props);
            LIST_OF_COMPONENTS = list;
            cacheMemory[bifrostVersion].components = list;
            cacheMemory[bifrostVersion].meta = props;
          } else {
            console.error('The file does not exist:', fp);
          }
        }
      }
    }
  }
};

// TODO: Type update
const getPropsList = (snips: any) => {
  const propList = {} as any;

  for (const componentPath in snips) {
    if (snips.hasOwnProperty(componentPath)) {
      const componentInfo = snips[componentPath];
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

      propList[componentName] = {
        ...componentInfo,
        component: componentName,
        props: propsArray,
        storybook: componentInfo?.storybook || '',
        zeroHeight: componentInfo?.zeroHeight || '',
      };
    }
  }
  return propList;
};

// const isComponentImportedFromLibrary = (document, componentName) => {
//   const text = document.getText();
//   const importStatementRegex =
//     /import\s*{[^}]*}\s*from\s*['"]@browserstack\/bifrost['"]/g;
//   const matches = text.match(importStatementRegex);

//   if (!matches) {
//     return false;
//   }

//   for (const match of matches) {
//     if (
//       match.includes(componentName) &&
//       LIST_OF_COMPONENTS.includes(componentName)
//     ) {
//       return true;
//     }
//   }

//   return false;
// };

// TODO: Type update
const provideHover = (document: any, position: any) => {
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return;
  }

  const hoveredWord = document.getText(wordRange);

  if (LIST_OF_COMPONENTS.includes(hoveredWord)) {
    // TODO: Type update
    const formatProp = (prop: any) => {
      return `- **${prop.name}** (${prop.type}) ${
        prop.description ? ': ' + prop.description : ''
      }`;
    };

    const formatDisplayName = (displayName: any, description: any) => {
      return `**${displayName}** ${description ? ': ' + description : ''}`;
    };

    const component = cacheMemory[bifrostVersion].meta[hoveredWord];

    const tooltipContent = new vscode.MarkdownString(
      `import { ${hoveredWord} } from "@browserstack/bifrost";\n\n${formatDisplayName(
        hoveredWord,
        component?.description
      )}\n\nProps:\n${component.props
        .map(formatProp)
        .join('\n')}\n\n[Storybook](${component?.storybook}) | \n[ZeroHeight](${
        component?.zeroHeight
      })`
    );

    return new vscode.Hover(tooltipContent);
  }
};

// TODO: Type update
async function getAdditionalTextEdits({ components = [] }: any) {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || !components.length) {
    return [];
  }

  let existingComponents: Set<string>;
  let insertPosition: vscode.Position = new vscode.Position(0, 0);
  let coreInsertPosition: vscode.Position | null = null;

  try {
    ({ existingComponents, insertPosition, coreInsertPosition } =
      getExistingImports(document));
  } catch (error) {
    return [];
  }

  const corePath = '@browserstack/bifrost';

  const additionalTextEdits: vscode.TextEdit[] = [];

  // TODO: Type update
  const coreImports = components.filter((c: any) => !existingComponents.has(c));

  if (coreImports.length) {
    if (coreInsertPosition) {
      additionalTextEdits.push(
        vscode.TextEdit.insert(
          coreInsertPosition,
          ', ' + coreImports.join(', ')
        )
      );
    } else {
      additionalTextEdits.push(
        vscode.TextEdit.insert(
          insertPosition,
          `import { ${coreImports.join(', ')} } from '${corePath}';\n`
        )
      );
    }
  }

  return additionalTextEdits;
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
        // console.log('Folder changed!!');
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
            currentPkgApp = nearestPackageJson[2];
            currentPkgAppPath = nearestPackageJson[1];

            if (
              cacheMemory[bifrostVersion] ||
              cacheMemory[bifrostVersion]?.options?.length
            ) {
              // console.log('Text Cached entry change...');
              LIST_OF_COMPONENTS = cacheMemory[bifrostVersion]?.components;
            } else {
              // console.log('Text Fresh entry change...');

              const fp =
                currentPkgAppPath +
                '/node_modules/@browserstack/bifrost/dist/snippets.json';
              if (fs.existsSync(fp)) {
                const rawData = fs.readFileSync(fp) as any;

                const snippets = JSON.parse(rawData);

                !(bifrostVersion in cacheMemory) &&
                  (cacheMemory[bifrostVersion] = {
                    options: [],
                    components: [],
                    meta: {},
                  });

                const props = getPropsList(snippets);
                const list = Object.keys(props);
                LIST_OF_COMPONENTS = list;
                cacheMemory[bifrostVersion].components = list;
                cacheMemory[bifrostVersion].meta = props;
              } else {
                console.error('The file does not exist:', fp);
              }
            }
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
        // console.log('picked from cache!!');
        return cacheMemory[bifrostVersion].options;
      }

      const rawData = fs.readFileSync(
        currentPkgAppPath +
          '/node_modules/@browserstack/bifrost/dist/snippets.json'
      ) as any; // TODO: type annote

      const snippets = JSON.parse(rawData);

      for (const key in snippets) {
        if (snippets.hasOwnProperty(key)) {
          const { displayName, description } = snippets[key];
          const body = `<${displayName}>$1</${displayName}>`;
          const completion = new MaterialUICompletionItem('bui' + displayName);
          completion.insertText = new vscode.SnippetString(body);
          completion.documentation = new vscode.MarkdownString(description);
          completion.components = [displayName];
          result.push(completion);
        }
      }

      !(bifrostVersion in cacheMemory) &&
        (cacheMemory[bifrostVersion] = {
          options: [],
          components: [],
          meta: {},
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
        async resolveCompletionItem(
          item: MaterialUICompletionItem
        ): Promise<MaterialUICompletionItem> {
          item.additionalTextEdits = await getAdditionalTextEdits(item);
          return item;
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
