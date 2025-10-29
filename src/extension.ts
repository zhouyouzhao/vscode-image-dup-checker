import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ImageInfo {
	filePath: string;
	md5: string;
	relativePath: string;
}

interface QuickPickItemWithPath extends vscode.QuickPickItem {
	filePath: string;
	relativePath: string;
}

/**
 * 计算文件的 MD5 值
 */
async function calculateMD5(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('md5');
		const stream = fs.createReadStream(filePath);

		stream.on('data', (data) => hash.update(data));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', (err) => reject(err));
	});
}

/**
 * 使用 glob 模式扫描图片文件
 */
async function scanImageFilesWithGlob(
	globPatterns: string[],
	workspaceRoot: string,
	progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ImageInfo[]> {
	const images: ImageInfo[] = [];
	
	// 如果没有指定模式，使用默认的扫描整个工作区
	if (globPatterns.length === 0) {
		return scanImageFilesDefault(workspaceRoot, progress);
	}

	// 获取配置的图片扩展名
	const config = vscode.workspace.getConfiguration('imageDupChecker');
	const imageExtensions = config.get<string[]>('imageExtensions') || [
		'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'
	];
	const normalizedExtensions = imageExtensions.map(ext => ext.toLowerCase());

	// 使用 VS Code 的 findFiles API 支持 glob 模式
	for (const pattern of globPatterns) {
		try {
			const files = await vscode.workspace.findFiles(
				pattern,
				'**/node_modules/**'
			);

			for (const file of files) {
				const filePath = file.fsPath;
				
				// 检查文件扩展名是否是图片
				const ext = path.extname(filePath).toLowerCase();
				if (!normalizedExtensions.includes(ext)) {
					continue;
				}

				try {
					const md5 = await calculateMD5(filePath);
					const relativePath = path.relative(workspaceRoot, filePath);
					images.push({
						filePath,
						md5,
						relativePath
					});
					progress.report({ message: `已扫描: ${relativePath}` });
				} catch (error) {
					console.error(`计算 MD5 失败: ${filePath}`, error);
				}
			}
		} catch (error) {
			console.error(`扫描模式失败: ${pattern}`, error);
		}
	}

	return images;
}

/**
 * 默认扫描方式：递归扫描目录下的所有图片文件
 */
async function scanImageFilesDefault(
	rootPath: string,
	progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ImageInfo[]> {
	const images: ImageInfo[] = [];
	const config = vscode.workspace.getConfiguration('imageDupChecker');
	const extensions = config.get<string[]>('imageExtensions') || [
		'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'
	];
	const normalizedExtensions = extensions.map(ext => ext.toLowerCase());

	async function scanDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				// 跳过 node_modules 和隐藏文件夹
				if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
					continue;
				}

				if (entry.isDirectory()) {
					await scanDirectory(fullPath);
				} else if (entry.isFile()) {
					const ext = path.extname(entry.name).toLowerCase();
					if (normalizedExtensions.includes(ext)) {
						try {
							const md5 = await calculateMD5(fullPath);
							const relativePath = path.relative(rootPath, fullPath);
							images.push({
								filePath: fullPath,
								md5,
								relativePath
							});
							progress.report({ message: `已扫描: ${relativePath}` });
						} catch (error) {
							console.error(`计算 MD5 失败: ${fullPath}`, error);
						}
					}
				}
			}
		} catch (error) {
			console.error(`扫描目录失败: ${dirPath}`, error);
		}
	}

	await scanDirectory(rootPath);
	return images;
}

/**
 * 查找与目标图片 MD5 相同的所有图片
 */
function findDuplicates(targetMD5: string, allImages: ImageInfo[]): ImageInfo[] {
	return allImages.filter(img => img.md5 === targetMD5);
}

/**
 * 创建带有复制按钮的 QuickPick
 */
async function showDuplicatesQuickPick(duplicates: ImageInfo[], targetPath: string): Promise<void> {
	const quickPick = vscode.window.createQuickPick<QuickPickItemWithPath>();
	quickPick.title = '重复图片列表';
	quickPick.placeholder = '选择图片以打开，或点击复制按钮复制路径';

	// 过滤掉当前选中的图片
	const filteredDuplicates = duplicates.filter(img => img.filePath !== targetPath);

	quickPick.items = filteredDuplicates.map(img => ({
		label: `$(file-media) ${path.basename(img.filePath)}`,
		description: '',
		detail: img.relativePath,
		filePath: img.filePath,
		relativePath: img.relativePath,
		buttons: [
			{
				iconPath: new vscode.ThemeIcon('copy'),
				tooltip: '复制路径'
			}
		]
	}));

	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected) {
			// 打开选中的文件
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selected.filePath));
		}
		quickPick.hide();
	});

	quickPick.onDidTriggerItemButton((e) => {
		// 复制相对路径到剪贴板
		const item = e.item as QuickPickItemWithPath;
		vscode.env.clipboard.writeText(item.relativePath);
		vscode.window.showInformationMessage(`已复制路径: ${item.relativePath}`);
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

export function activate(context: vscode.ExtensionContext) {
	console.log('图片重复检查器已激活');

	const disposable = vscode.commands.registerCommand(
		'image-dup-checker.checkDuplicates',
		async (uri: vscode.Uri) => {
			try {
				// 如果没有传入 URI，尝试从当前活动编辑器获取
				if (!uri) {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						uri = activeEditor.document.uri;
					}
				}

				// 如果还是没有 URI，提示用户选择文件
				if (!uri) {
					vscode.window.showErrorMessage('请选择一个图片文件');
					return;
				}

				const targetPath = uri.fsPath;

				// 检查文件是否存在
				if (!fs.existsSync(targetPath)) {
					vscode.window.showErrorMessage('文件不存在');
					return;
				}

				// 获取配置
				const config = vscode.workspace.getConfiguration('imageDupChecker');
				const imageExtensions = config.get<string[]>('imageExtensions') || [
					'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'
				];

				// 检查是否是图片文件
				const ext = path.extname(targetPath).toLowerCase();
				if (!imageExtensions.includes(ext)) {
					vscode.window.showErrorMessage('请选择一个图片文件');
					return;
				}

				// 确定搜索路径
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders || workspaceFolders.length === 0) {
					vscode.window.showErrorMessage('未打开工作区');
					return;
				}

				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				const searchPatterns = config.get<string[]>('searchPaths') || [];

				// 统一的进度提示，包含所有步骤
				const result = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Window,
						title: '查找重复图片',
						cancellable: false
					},
					async (progress) => {
						// 步骤 1: 计算目标图片的 MD5
						progress.report({ message: '计算图片 MD5...' });
						const targetMD5 = await calculateMD5(targetPath);

						// 步骤 2: 扫描所有图片
						progress.report({ message: '扫描图片文件...' });
						const allImages = await scanImageFilesWithGlob(
							searchPatterns,
							workspaceRoot,
							progress
						);

						// 步骤 3: 查找重复图片
						progress.report({ message: '查找重复项...' });
						const duplicates = findDuplicates(targetMD5, allImages);

						if (duplicates.length === 0) {
							return { success: false, message: '未找到重复图片' };
						}

						// 过滤掉当前图片后，检查是否还有其他重复图片
						const otherDuplicates = duplicates.filter(img => img.filePath !== targetPath);
						if (otherDuplicates.length === 0) {
							return { success: false, message: '未找到其他重复图片' };
						}

						return { success: true, duplicates };
					}
				);

				// 进度提示关闭后，再显示结果
				if (!result.success) {
					vscode.window.showInformationMessage(result.message!);
				} else {
					// 显示重复图片选择器
					await showDuplicatesQuickPick(result.duplicates!, targetPath);
				}

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`发生错误: ${errorMessage}`);
				console.error('图片重复检查失败:', error);
			}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}

