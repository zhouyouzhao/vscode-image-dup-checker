# 欢迎使用你的 VS Code 扩展

## 文件夹内容

* 此文件夹包含扩展所需的所有文件。
* `package.json` - 这是清单文件，你在其中声明扩展和命令。
  * 示例插件注册了一个命令，并定义了其标题和命令名称。有了这些信息，VS Code 可以在命令面板中显示该命令。它还不需要加载插件。
* `src/extension.ts` - 这是主文件，你将在其中提供命令的实现。
  * 该文件导出一个函数 `activate`，它在你的扩展第一次被激活时调用（在本例中通过执行命令）。在 `activate` 函数内部，我们调用 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 设置

* 安装推荐的扩展（amodio.tsl-problem-matcher, ms-vscode.extension-test-runner 和 dbaeumer.vscode-eslint）

## 立即开始

* 按 `F5` 打开一个加载了你的扩展的新窗口。
* 从命令面板按 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）并输入 `Check for Duplicate Images` 来运行你的命令。
* 在 `src/extension.ts` 中设置断点来调试你的扩展。
* 在调试控制台中查找你的扩展的输出。

## 进行更改

* 在 `src/extension.ts` 中更改代码后，你可以从调试工具栏重新启动扩展。
* 你也可以重新加载（`Ctrl+R` 或 Mac 上的 `Cmd+R`）VS Code 窗口来加载你的更改。

## 探索 API

* 你可以在打开文件 `node_modules/@types/vscode/index.d.ts` 时打开我们完整的 API 集。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 通过 **Tasks: Run Task** 命令运行 "watch" 任务。确保它正在运行，否则可能无法发现测试。
* 从活动栏打开测试视图并点击 "Run Test" 按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 在测试结果视图中查看测试结果的输出。
* 对 `src/test/extension.test.ts` 进行更改或在 `test` 文件夹内创建新的测试文件。
  * 提供的测试运行器只会考虑匹配名称模式 `**.test.ts` 的文件。
  * 你可以在 `test` 文件夹内创建文件夹，以任何你想要的方式构建你的测试。

## 更进一步

* 通过[打包你的扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)来减少扩展大小并缩短启动时间。
* 在 VS Code 扩展市场上[发布你的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置[持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)来自动化构建。

