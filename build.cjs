#!/usr/bin/env node

/**
 * 构建脚本 - 编译 TypeScript 到 JavaScript
 * @description 用于将 TypeScript 源码编译为 JavaScript，优化发布流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 控制台颜色工具
 */
class BuildColors {
  static get RESET() { return '\x1b[0m'; }
  static get GREEN() { return '\x1b[32m'; }
  static get YELLOW() { return '\x1b[33m'; }
  static get BLUE() { return '\x1b[34m'; }
  static get RED() { return '\x1b[31m'; }
  static get CYAN() { return '\x1b[36m'; }

  static success(text) {
    return `${this.GREEN}✅ ${text}${this.RESET}`;
  }

  static info(text) {
    return `${this.BLUE}ℹ️  ${text}${this.RESET}`;
  }

  static warning(text) {
    return `${this.YELLOW}⚠️  ${text}${this.RESET}`;
  }

  static error(text) {
    return `${this.RED}❌ ${text}${this.RESET}`;
  }

  static step(text) {
    return `${this.CYAN}🔧 ${text}${this.RESET}`;
  }
}

/**
 * 执行命令并输出结果
 */
function executeCommand(command, description) {
  console.log(BuildColors.step(description));
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(BuildColors.success(`${description} 完成`));
    return output;
  } catch (error) {
    console.error(BuildColors.error(`${description} 失败: ${error.message}`));
    process.exit(1);
  }
}

/**
 * 清理构建目录
 */
function cleanBuildDir() {
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log(BuildColors.success('清理构建目录完成'));
  }
}

/**
 * 创建构建目录
 */
function createBuildDir() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log(BuildColors.success('创建构建目录完成'));
  }
}

/**
 * 使用 Bun.build() API 编译 TypeScript（优化版本）
 */
async function compileTypeScript() {
  // 检查是否安装了 bun
  try {
    execSync('bun --version', { stdio: 'pipe' });
  } catch (error) {
    console.error(BuildColors.error('Bun 未安装，请先安装 bun: https://bun.sh'));
    process.exit(1);
  }

  console.log(BuildColors.step('编译 TypeScript 为优化的 JavaScript bundle'));
  
  try {
    // 使用 Bun.build() JavaScript API 获得更好的控制
    const { spawn } = require('child_process');
    const buildScript = `
      const result = await Bun.build({
        entrypoints: ['./migrate-gitlab.ts'],
        outdir: './dist',
        target: 'bun',
        format: 'esm',
        minify: true,
        sourcemap: 'external',
        splitting: false,
        // 排除不必要的依赖以减少文件大小
        external: [],
        // 启用死代码消除
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      });
      
      if (!result.success) {
        console.error('Build failed:', result.logs);
        process.exit(1);
      }
      
      console.log('Build completed successfully');
    `;
    
    // 将构建脚本写入临时文件并执行
    const tempBuildFile = path.join(__dirname, 'temp-build.mjs');
    fs.writeFileSync(tempBuildFile, buildScript);
    
    try {
      execSync(`bun run ${tempBuildFile}`, { stdio: 'inherit' });
      fs.unlinkSync(tempBuildFile); // 清理临时文件
      console.log(BuildColors.success('编译 TypeScript 为优化的 JavaScript bundle 完成'));
      console.log(BuildColors.success('✨ 代码已最小化和优化'));
    } catch (buildError) {
      fs.unlinkSync(tempBuildFile); // 清理临时文件
      throw buildError;
    }
    
  } catch (error) {
    console.error(BuildColors.error(`构建失败: ${error.message}`));
    // 回退到 CLI 命令
    console.log(BuildColors.warning('回退到 CLI 命令模式'));
    const buildCommand = [
      'bun build migrate-gitlab.ts',
      '--outdir dist',
      '--target bun',
      '--format esm',
      '--minify',
      '--sourcemap=external',
      '--define process.env.NODE_ENV="production"'
    ].join(' ');
    
    executeCommand(buildCommand, '编译 TypeScript 为优化的 JavaScript bundle (CLI 模式)');
    console.log(BuildColors.success('✨ 代码已最小化和优化'));
  }
  
  // 使用 bun tsc 配合 tsconfig.json 生成 TypeScript 声明文件
  console.log(BuildColors.info('📝 生成 TypeScript 声明文件'));
  try {
    executeCommand('bun tsc --declaration --emitDeclarationOnly --outDir dist', '生成 TypeScript 声明文件');
    console.log(BuildColors.success('📝 TypeScript 声明文件已生成'));
  } catch (error) {
    console.log(BuildColors.warning('⚠️  TypeScript 声明文件生成失败，跳过此步骤'));
    console.log(BuildColors.warning(`错误详情: ${error.message}`));
  }
}









/**
 * 复制必要文件
 */
function copyFiles() {
  const filesToCopy = ['package.json', 'README.md'];
  
  filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join('dist', file));
      console.log(BuildColors.success(`复制 ${file} 完成`));
    }
  });
}

// 移除平台特定的启动脚本创建函数
// bun 本身已经提供了跨平台支持，不需要额外的脚本

/**
 * 更新 package.json 中的 bin 路径
 */
function updatePackageJson() {
  const packageJsonPath = path.join('dist', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // 更新 bin 路径指向编译后的 JS 文件
    if (packageJson.bin) {
      Object.keys(packageJson.bin).forEach(key => {
        packageJson.bin[key] = packageJson.bin[key].replace('./dist/migrate-gitlab.js', './migrate-gitlab.js').replace('migrate-gitlab.ts', 'migrate-gitlab.js');
      });
    }
    
    // 更新 main 字段
    if (packageJson.main) {
      packageJson.main = packageJson.main.replace('migrate-gitlab.ts', 'migrate-gitlab.js');
    }
    
    // 确保 type 字段为 module（ES 模块）
    packageJson.type = 'module';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(BuildColors.success('更新 package.json 完成'));
  }
}

/**
 * 设置文件权限（Unix 系统）
 */
function setExecutablePermission() {
  const jsFilePath = path.join('dist', 'migrate-gitlab.js');
  if (fs.existsSync(jsFilePath) && process.platform !== 'win32') {
    try {
      execSync(`chmod +x ${jsFilePath}`);
      console.log(BuildColors.success('设置可执行权限完成'));
    } catch (error) {
      console.log(BuildColors.warning('设置可执行权限失败，请手动设置'));
    }
  }
}

/**
 * 主构建流程
 */
async function main() {
  console.log(BuildColors.info('开始构建 GitLab 迁移工具...'));
  console.log('');
  
  try {
    cleanBuildDir();
    createBuildDir();
    await compileTypeScript();
    copyFiles();
    updatePackageJson();
    setExecutablePermission();
    
    console.log('');
    console.log(BuildColors.success('🎉 构建完成！'));
    console.log(BuildColors.info('✨ 构建产物已优化（最小化 + source map）'));
    console.log(BuildColors.info('📝 TypeScript 声明文件已生成'));
    console.log(BuildColors.info('🌍 支持跨平台运行（bun 原生支持）'));
    console.log(BuildColors.info('🎯 使用 Bun 目标优化，获得最佳性能'));
    console.log(BuildColors.info('构建产物位于 dist/ 目录'));
    console.log('');
    console.log(BuildColors.info('📦 可用的运行方式:'));
    console.log(BuildColors.info('  1. JavaScript Bundle: bun run dist/migrate-gitlab.js'));
    console.log(BuildColors.info('  2. Node.js: node dist/migrate-gitlab.js'));
    console.log('');
    console.log(BuildColors.info('💡 JavaScript Bundle 具有最佳的兼容性和性能'));
    console.log(BuildColors.info('可以使用 "npm publish dist" 发布到 npm'));
    
  } catch (error) {
    console.error(BuildColors.error(`构建失败: ${error.message}`));
    process.exit(1);
  }
}

// 运行构建
if (require.main === module) {
  main().catch(error => {
    console.error(BuildColors.error(`构建失败: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { main };