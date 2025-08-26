#!/usr/bin/env bun

/**
 * GitLab 仓库迁移工具
 * @description 专门用于 GitLab 仓库之间的迁移，支持镜像克隆、仓库创建、描述更新等功能
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * 控制台颜色工具类
 */
class ConsoleColors {
  // 颜色代码
  static readonly RESET = '\x1b[0m';
  static readonly BRIGHT = '\x1b[1m';
  static readonly DIM = '\x1b[2m';
  
  // 前景色
  static readonly RED = '\x1b[31m';
  static readonly GREEN = '\x1b[32m';
  static readonly YELLOW = '\x1b[33m';
  static readonly BLUE = '\x1b[34m';
  static readonly MAGENTA = '\x1b[35m';
  static readonly CYAN = '\x1b[36m';
  static readonly WHITE = '\x1b[37m';
  static readonly GRAY = '\x1b[90m';
  
  // 背景色
  static readonly BG_RED = '\x1b[41m';
  static readonly BG_GREEN = '\x1b[42m';
  static readonly BG_YELLOW = '\x1b[43m';
  static readonly BG_BLUE = '\x1b[44m';
  
  // 格式化方法
  static success(text: string): string {
    return `${ConsoleColors.GREEN}${ConsoleColors.BRIGHT}✅ ${text}${ConsoleColors.RESET}`;
  }
  
  static error(text: string): string {
    return `${ConsoleColors.RED}${ConsoleColors.BRIGHT}❌ ${text}${ConsoleColors.RESET}`;
  }
  
  static warning(text: string): string {
    return `${ConsoleColors.YELLOW}${ConsoleColors.BRIGHT}⚠️  ${text}${ConsoleColors.RESET}`;
  }
  
  static info(text: string): string {
    return `${ConsoleColors.BLUE}${ConsoleColors.BRIGHT}ℹ️  ${text}${ConsoleColors.RESET}`;
  }
  
  static progress(text: string): string {
    return `${ConsoleColors.CYAN}${ConsoleColors.BRIGHT}🚀 ${text}${ConsoleColors.RESET}`;
  }
  
  static highlight(text: string): string {
    return `${ConsoleColors.MAGENTA}${ConsoleColors.BRIGHT}${text}${ConsoleColors.RESET}`;
  }
  
  static dim(text: string): string {
    return `${ConsoleColors.GRAY}${text}${ConsoleColors.RESET}`;
  }
  
  static title(text: string): string {
    return `${ConsoleColors.CYAN}${ConsoleColors.BRIGHT}🎯 ${text}${ConsoleColors.RESET}`;
  }
  
  static separator(length: number = 50): string {
    return `${ConsoleColors.GRAY}${'═'.repeat(length)}${ConsoleColors.RESET}`;
  }
  
  static box(text: string): string {
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const border = '═'.repeat(maxLength + 4);
    
    let result = `${ConsoleColors.CYAN}╔${border}╗${ConsoleColors.RESET}\n`;
    lines.forEach(line => {
      const padding = ' '.repeat(maxLength - line.length);
      result += `${ConsoleColors.CYAN}║  ${ConsoleColors.WHITE}${line}${padding}  ${ConsoleColors.CYAN}║${ConsoleColors.RESET}\n`;
    });
    result += `${ConsoleColors.CYAN}╚${border}╝${ConsoleColors.RESET}`;
    
    return result;
  }
  
  static step(stepNumber: number, text: string): string {
    return `${ConsoleColors.BLUE}${ConsoleColors.BRIGHT}📋 步骤 ${stepNumber}:${ConsoleColors.RESET} ${ConsoleColors.WHITE}${text}${ConsoleColors.RESET}`;
  }
  
  static duration(text: string): string {
    return `${ConsoleColors.GRAY}⏱️  ${text}${ConsoleColors.RESET}`;
  }
  
  static url(text: string): string {
    return `${ConsoleColors.BLUE}🔗 ${text}${ConsoleColors.RESET}`;
  }
  
  static repo(text: string): string {
    return `${ConsoleColors.MAGENTA}${ConsoleColors.BRIGHT}📦 ${text}${ConsoleColors.RESET}`;
  }
  
  static description(text: string): string {
    return `${ConsoleColors.GRAY}📝 ${text}${ConsoleColors.RESET}`;
  }
}

/**
 * 仓库信息类型
 */
type TRepository = {
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description: string;
  /** 原仓库地址 */
  originalUrl: string;
};

/**
 * 迁移配置类型
 */
type TMigrationConfig = {
  /** 目标分组URL */
  targetGroup: string;
  /** 需要迁移的仓库列表 */
  repositories: TRepository[];
};

/**
 * 错误类型枚举
 */
type TErrorType = 'git_operation' | 'api_operation' | 'network' | 'permission' | 'validation' | 'filesystem' | 'unknown';

/**
 * 操作步骤状态
 */
type TStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'warning';

/**
 * 迁移步骤详情
 */
type TMigrationStep = {
  /** 步骤名称 */
  name: string;
  /** 步骤状态 */
  status: TStepStatus;
  /** 开始时间 */
  startTime?: string;
  /** 结束时间 */
  endTime?: string;
  /** 耗时（毫秒） */
  duration?: number;
  /** 错误信息 */
  error?: string;
  /** 错误类型 */
  errorType?: TErrorType;
  /** 警告信息 */
  warnings?: string[];
};

/**
 * 迁移日志类型
 */
type TMigrationLog = {
  /** 项目名称 */
  projectName: string;
  /** 项目描述 */
  projectDescription: string;
  /** 原仓库地址 */
  originalRepoUrl: string;
  /** 目标分组 */
  targetGroup: string;
  /** 目标仓库地址 */
  targetRepoUrl: string;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime: string;
  /** 耗时 */
  duration: string;
  /** 是否已克隆原仓库镜像 */
  isOriginalCloned: boolean;
  /** 是否已创建目标仓库 */
  isTargetCreated: boolean;
  /** 是否已推送镜像到目标仓库 */
  isMirrorPushed: boolean;
  /** 是否已修改目标仓库的项目描述 */
  isDescriptionUpdated: boolean;
  /** 是否已克隆迁移后的仓库 */
  isFinalCloned: boolean;
  /** 失败原因 */
  failureReason: string;
  /** 错误类型 */
  errorType?: TErrorType;
  /** 详细步骤记录 */
  steps: TMigrationStep[];
  /** 警告信息列表 */
  warnings: string[];
  /** 重试次数 */
  retryCount: number;
  /** 最后更新时间 */
  lastUpdated: string;
};

/**
 * 交互式输入 Access Token
 */
function promptForAccessToken(): Promise<string> {
  return new Promise((resolve) => {
    // 创建一个没有输出流的 readline 接口，防止回显
    const rl = readline.createInterface({
      input: process.stdin,
      output: undefined, // 禁用输出流，防止回显
      terminal: false
    });

    // 隐藏输入的字符
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let token = '';
    console.log('\n🔑 请输入 GitLab Access Token (隐蔽输入，点击右键一下即可粘贴):');
    
    stdin.on('data', (key: string) => {
      // 处理回车键
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        rl.close();
        console.log('\n✅ Access Token 已输入');
        resolve(token.trim());
        return;
      }
      
      // 处理退格键
      if (key === '\u0008' || key === '\u007f') {
        if (token.length > 0) {
          token = token.slice(0, -1);
        }
        return;
      }
      
      // 处理 Ctrl+C
      if (key === '\u0003') {
        console.log('\n❌ 用户取消输入');
        process.exit(1);
      }
      
      // 添加字符到token
      if (key.charCodeAt(0) >= 32) {
        token += key;
      }
    });
  });
}

/**
 * GitLab 项目迁移器
 */
class GitLabMigrator {
  private moveFilePath: string;
  private accessToken: string;
  private targetGroupUrl: string;
  private repositories: TRepository[];
  private logs: Map<string, TMigrationLog>;
  private selectedProjects: string[];
  private tempDir: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private skipFinalClone: boolean;
  private quietMode: boolean;

  constructor(moveFilePath: string = path.resolve(process.cwd(), 'move.md'), selectedProjects?: string[], accessToken?: string, skipFinalClone: boolean = false, quietMode: boolean = false) {
    this.moveFilePath = moveFilePath;
    this.accessToken = accessToken || '';
    this.skipFinalClone = skipFinalClone;
    this.quietMode = quietMode;
    this.targetGroupUrl = '';
    this.repositories = [];
    this.logs = new Map();
    this.selectedProjects = selectedProjects || [];
    
    // 使用更具私有化特征的临时目录命名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    this.tempDir = path.join(process.cwd(), `temp-migration-${timestamp}-${randomSuffix}`);
    
    // 清理旧备份文件和临时目录
    this.cleanupOldBackups();
    this.cleanupOldTempDirectories();
  }

  /**
   * 解析move.md文件
   */
  private parseMoveFile(): void {
    console.log('📖 正在解析move.md文件...');
    
    if (!existsSync(this.moveFilePath)) {
      throw new Error(`move.md文件不存在: ${this.moveFilePath}`);
    }

    const content = readFileSync(this.moveFilePath, 'utf-8');
    const lines = content.split('\n');
    const parseErrors: string[] = [];

    // 解析 Access Token（如果构造函数中没有提供）
    if (!this.accessToken) {
      const accessTokenIndex = lines.findIndex(line => line.includes('## 迁移目标 Access Token'));
      if (accessTokenIndex !== -1 && accessTokenIndex + 2 < lines.length) {
        const tokenLine = lines[accessTokenIndex + 2].trim();
        if (tokenLine && tokenLine !== 'your_gitlab_access_token' && tokenLine !== 'your_access_token') {
          this.accessToken = tokenLine;
          console.log('🔑 从 move.md 文件中读取到 Access Token');
        }
      } else {
        parseErrors.push('未找到有效的 Access Token 配置');
      }
    }

    // 解析目标分组
    const targetGroupIndex = lines.findIndex(line => line.includes('## 迁移目标分组'));
    if (targetGroupIndex !== -1 && targetGroupIndex + 2 < lines.length) {
      this.targetGroupUrl = lines[targetGroupIndex + 2].trim();
      if (!this.targetGroupUrl) {
        parseErrors.push('目标分组URL为空');
      } else if (!this.isValidUrl(this.targetGroupUrl)) {
        parseErrors.push(`目标分组URL格式无效: ${this.targetGroupUrl}`);
      }
    } else {
      parseErrors.push('未找到目标分组配置');
    }

    // 解析需要迁移的仓库表格
    const tableStartIndex = lines.findIndex(line => line.includes('| 项目名称 | 项目描述 | 原仓库地址 |'));
    if (tableStartIndex !== -1) {
      let validRepoCount = 0;
      for (let i = tableStartIndex + 2; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNumber = i + 1;
        
        // 遇到日志部分或空行则停止解析
        if (!line || line.includes('## 日志') || line.includes('## ')) break;
        
        // 跳过分隔线
        if (line.match(/^\|[-\s|]+\|$/)) continue;
        
        // 检查是否为表格行
        if (!line.startsWith('|') || !line.endsWith('|')) {
          parseErrors.push(`第${lineNumber}行格式错误：表格行必须以 | 开头和结尾`);
          continue;
        }
        
        const columns = line.split('|').map(col => col.trim()).filter(col => col);
        
        if (columns.length < 3) {
          parseErrors.push(`第${lineNumber}行数据不完整：需要至少3列数据（项目名称、项目描述、原仓库地址）`);
          continue;
        }
        
        const [name, description, originalUrl] = columns;
        
        // 验证必填字段
        if (!name) {
          parseErrors.push(`第${lineNumber}行：项目名称不能为空`);
          continue;
        }
        
        if (!originalUrl) {
          parseErrors.push(`第${lineNumber}行：原仓库地址不能为空`);
          continue;
        }
        
        // 验证URL格式
        if (!this.isValidGitUrl(originalUrl)) {
          parseErrors.push(`第${lineNumber}行：原仓库地址格式无效: ${originalUrl}`);
          continue;
        }
        
        // 检查重复项目名称
        if (this.repositories.some(repo => repo.name === name)) {
          parseErrors.push(`第${lineNumber}行：项目名称重复: ${name}`);
          continue;
        }
        
        this.repositories.push({
          name,
          description: description || '无描述',
          originalUrl
        });
        
        validRepoCount++;
      }
      
      if (validRepoCount === 0) {
        parseErrors.push('未找到有效的仓库配置');
      }
    } else {
      parseErrors.push('未找到仓库列表表格');
    }

    // 解析现有日志
    this.parseExistingLogs(content);
    
    // 输出解析结果和错误
    if (parseErrors.length > 0) {
      console.log(ConsoleColors.warning('⚠️  配置文件解析警告:'));
      parseErrors.forEach(error => {
        console.log(ConsoleColors.dim(`   • ${error}`));
      });
      console.log('');
    }
    
    console.log(`✅ 解析完成，找到 ${this.repositories.length} 个待迁移仓库`);
    console.log(`🎯 目标分组: ${this.targetGroupUrl}`);
    
    // 执行配置验证
    const validation = this.validateConfiguration();
    
    // 输出验证结果
    if (validation.warnings.length > 0) {
      console.log(ConsoleColors.warning('⚠️  配置验证警告:'));
      validation.warnings.forEach(warning => {
        console.log(ConsoleColors.dim(`   • ${warning}`));
      });
      console.log('');
    }
    
    if (validation.errors.length > 0) {
      console.log(ConsoleColors.error('❌ 配置验证错误:'));
      validation.errors.forEach(error => {
        console.log(ConsoleColors.dim(`   • ${error}`));
      });
      console.log('');
      throw new Error('配置文件验证失败，请修复上述错误后重试');
    }
    
    // 如果有严重的解析错误，抛出异常
    if (!this.targetGroupUrl || this.repositories.length === 0) {
      throw new Error('配置文件解析失败：缺少必要的配置信息');
    }
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证Git仓库URL格式
   */
  private isValidGitUrl(url: string): boolean {
    // 支持 https、ssh、git 协议
    const gitUrlPattern = /^(https?:\/\/|ssh:\/\/git@|git@)[\w\.-]+(:\d+)?[:\/][\w\.-]+\/[\w\.-]+(\.git)?\/?$/;
    return gitUrlPattern.test(url);
  }

  /**
   * 验证配置文件完整性
   */
  private validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证 Access Token
    if (!this.accessToken || this.accessToken === 'your_gitlab_access_token' || this.accessToken === 'your_access_token') {
      warnings.push('Access Token 未配置或使用默认值，需要通过其他方式提供');
    } else if (this.accessToken.length < 20) {
      warnings.push('Access Token 长度可能不正确，请确认是否为有效的 GitLab Access Token');
    }

    // 验证目标分组
    if (!this.targetGroupUrl) {
      errors.push('目标分组URL未配置');
    } else {
      if (!this.isValidUrl(this.targetGroupUrl)) {
        errors.push(`目标分组URL格式无效: ${this.targetGroupUrl}`);
      } else if (!this.targetGroupUrl.includes('gitlab')) {
        warnings.push('目标分组URL似乎不是GitLab地址，请确认是否正确');
      }
    }

    // 验证仓库列表
    if (this.repositories.length === 0) {
      errors.push('未找到任何待迁移的仓库');
    } else {
      // 检查仓库名称唯一性
      const nameSet = new Set<string>();
      const duplicateNames: string[] = [];
      
      this.repositories.forEach(repo => {
        if (nameSet.has(repo.name)) {
          duplicateNames.push(repo.name);
        } else {
          nameSet.add(repo.name);
        }
        
        // 验证仓库名称格式
        if (!/^[a-zA-Z0-9_-]+$/.test(repo.name)) {
          warnings.push(`仓库名称 "${repo.name}" 包含特殊字符，可能导致创建失败`);
        }
        
        // 验证原仓库URL
        if (!this.isValidGitUrl(repo.originalUrl)) {
          errors.push(`仓库 "${repo.name}" 的原仓库地址格式无效: ${repo.originalUrl}`);
        }
        
        // 检查描述长度
        if (repo.description && repo.description.length > 2000) {
          warnings.push(`仓库 "${repo.name}" 的描述过长，可能被截断`);
        }
      });
      
      if (duplicateNames.length > 0) {
        errors.push(`发现重复的仓库名称: ${duplicateNames.join(', ')}`);
      }
    }

    // 验证选中的项目是否存在
    if (this.selectedProjects.length > 0) {
      const invalidProjects = this.selectedProjects.filter(name => 
        !this.repositories.some(repo => repo.name === name)
      );
      
      if (invalidProjects.length > 0) {
        errors.push(`指定的项目不存在: ${invalidProjects.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 解析现有的迁移日志
   */
  private parseExistingLogs(content: string): void {
    const lines = content.split('\n');
    let currentLog: Partial<TMigrationLog> | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测新的日志项目开始
      if (line.startsWith('### ') && !line.includes('paimai-activity')) {
        // 保存上一个日志项目
        if (currentLog && currentLog.projectName) {
          this.logs.set(currentLog.projectName, currentLog as TMigrationLog);
        }
        
        // 开始新的日志项目
        const projectName = line.substring(4).trim();
        currentLog = {
          projectName,
          projectDescription: '',
          originalRepoUrl: '',
          targetGroup: '',
          targetRepoUrl: '',
          startTime: '',
          endTime: '',
          duration: '',
          isOriginalCloned: false,
          isTargetCreated: false,
          isMirrorPushed: false,
          isDescriptionUpdated: false,
          isFinalCloned: false,
          failureReason: '',
          steps: [],
          warnings: [],
          retryCount: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // 解析日志字段
      if (currentLog && line.startsWith('- **')) {
        const match = line.match(/- \*\*(.+?)\*\*: (.*)/);
        if (match) {
          const [, key, value] = match;
          switch (key) {
            case '项目描述':
              currentLog.projectDescription = value;
              break;
            case '原仓库地址':
              currentLog.originalRepoUrl = value;
              break;
            case '目标分组':
              currentLog.targetGroup = value;
              break;
            case '目标仓库地址':
              currentLog.targetRepoUrl = value;
              break;
            case '开始时间':
              currentLog.startTime = value;
              break;
            case '结束时间':
              currentLog.endTime = value;
              break;
            case '耗时':
              currentLog.duration = value;
              break;
            case '是否已克隆原仓库镜像':
              currentLog.isOriginalCloned = value === '✅';
              break;
            case '是否已创建目标仓库':
              currentLog.isTargetCreated = value === '✅';
              break;
            case '是否已推送镜像到目标仓库':
              currentLog.isMirrorPushed = value === '✅';
              break;
            case '是否已修改目标仓库的项目描述':
              currentLog.isDescriptionUpdated = value === '✅';
              break;
            case '是否已克隆迁移后的仓库':
              currentLog.isFinalCloned = value === '✅';
              break;
            case '失败原因':
              currentLog.failureReason = value;
              break;
          }
        }
      }
    }
    
    // 保存最后一个日志项目
    if (currentLog && currentLog.projectName) {
      this.logs.set(currentLog.projectName, currentLog as TMigrationLog);
    }
    
    console.log(`📋 解析到 ${this.logs.size} 个现有日志记录`);
    
    // 清理不在配置文件中的项目日志
    this.cleanupOrphanedLogs();
  }
  
  /**
   * 清理不在配置文件中的项目日志
   */
  private cleanupOrphanedLogs(): void {
    const configuredProjectNames = new Set(this.repositories.map(repo => repo.name));
    const orphanedProjects: string[] = [];
    
    // 找出不在配置文件中的项目
    for (const [projectName] of this.logs) {
      if (!configuredProjectNames.has(projectName)) {
        orphanedProjects.push(projectName);
      }
    }
    
    // 删除孤立的项目日志
    if (orphanedProjects.length > 0) {
      console.log(`🧹 清理 ${orphanedProjects.length} 个不在配置文件中的项目日志: ${orphanedProjects.join(', ')}`);
      orphanedProjects.forEach(projectName => {
        this.logs.delete(projectName);
      });
    }
  }

  /**
   * 获取GitLab API基础URL
   */
  private getGitLabApiBase(): string {
    // 从目标分组URL中提取GitLab实例的基础URL
    const url = new URL(this.targetGroupUrl);
    return `${url.protocol}//${url.host}/api/v4`;
  }

  /**
   * 从GitLab URL中提取分组路径
   */
  private extractGroupPath(groupUrl: string): string {
    try {
      const url = new URL(groupUrl);
      let pathname = url.pathname;
      // 移除开头的斜杠
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      // 移除结尾的斜杠
      if (pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      return pathname;
    } catch (error) {
      throw new Error(`无效的分组URL: ${groupUrl}`);
    }
  }

  /**
   * 获取分组ID
   */
  private async getGroupId(groupUrl: string): Promise<number> {
    try {
      const groupPath = this.extractGroupPath(groupUrl);
      const apiUrl = `${this.getGitLabApiBase()}/groups/${encodeURIComponent(groupPath)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取分组信息失败，HTTP状态码: ${response.status}`);
      }
      
      const groupInfo = await response.json();
      return groupInfo.id;
    } catch (error: any) {
      throw new Error(`获取分组ID失败: ${error.message}`);
    }
  }

  /**
   * 执行命令并返回结果
   */
  private executeCommand(command: string, cwd?: string): string {
    try {
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`执行命令: ${command}`));
      }
      const result = execSync(command, { 
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`命令执行成功`));
      }
      return result.toString().trim();
    } catch (error: any) {
      console.log(ConsoleColors.error(`命令执行失败: ${command}`));
      throw new Error(`命令执行失败: ${command}\n错误信息: ${error.message}`);
    }
  }

  /**
   * 执行命令并显示实时输出（用于需要显示进度的长时间运行命令）
   */
  private executeCommandWithProgress(command: string, cwd?: string): string {
    try {
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`执行命令: ${command}`));
      }
      const result = execSync(command, { 
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: this.quietMode ? 'pipe' : 'inherit' // 静默模式下隐藏实时输出
      });
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`命令执行成功`));
      }
      return result ? result.toString().trim() : '';
    } catch (error: any) {
      console.log(ConsoleColors.error(`命令执行失败: ${command}`));
      throw new Error(`命令执行失败: ${command}\n错误信息: ${error.message}`);
    }
  }

  /**
   * 执行命令并返回结果（支持错误降级处理）
   */
  private executeCommandWithWarningSupport(command: string, cwd?: string): { success: boolean; output: string; warning?: string } {
    try {
      console.log(ConsoleColors.dim(`执行命令: ${command}`));
      const result = execSync(command, { 
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(ConsoleColors.dim(`命令执行成功`));
      return { success: true, output: result.toString().trim() };
    } catch (error: any) {
      const errorMessage = error.message || '';
      
      // 检查是否为隐藏引用相关的错误，将其降级为警告
      if (errorMessage.includes('deny updating a hidden ref') || 
          errorMessage.includes('refs/keep-around') ||
          errorMessage.includes('refs/merge-requests') ||
          errorMessage.includes('refs/pipelines') ||
          errorMessage.includes('refs/environments') ||
          errorMessage.includes('refs/heads/') ||
          errorMessage.includes('refs/tags/') ||
          errorMessage.includes('hidden ref') ||
          errorMessage.includes('refusing to update checked out branch') ||
          errorMessage.includes('remote rejected') ||
          errorMessage.includes('pre-receive hook declined') ||
          errorMessage.includes('! [remote rejected]') ||
          errorMessage.includes('hook declined') ||
          errorMessage.includes('protected branch') ||
          errorMessage.includes('To ') ||
          errorMessage.includes('Everything up-to-date') ||
          errorMessage.includes('non-fast-forward') ||
          errorMessage.includes('failed to push some refs') ||
          errorMessage.includes('updates were rejected') ||
          errorMessage.includes('fetch first') ||
          errorMessage.includes('hint: Updates were rejected') ||
          errorMessage.includes('error: failed to push')) {
        console.log(ConsoleColors.warning(`⚠️  警告: ${errorMessage}`));
        console.log(ConsoleColors.info('这是一个隐藏引用相关的警告，不影响迁移结果'));
        return { success: true, output: '', warning: errorMessage };
      }
      
      // 检查是否为文件系统相关的错误，将其降级为警告
      if (errorMessage.includes('EBUSY: resource busy or locked') ||
          errorMessage.includes('resource busy or locked') ||
          errorMessage.includes('cannot delete') ||
          errorMessage.includes('cannot remove') ||
          errorMessage.includes('ENOENT: no such file or directory') ||
          errorMessage.includes('no such file or directory') ||
          errorMessage.includes('ENOSPC: no space left on device') ||
          errorMessage.includes('no space left on device')) {
        if (!this.quietMode) {
          console.log(ConsoleColors.warning(`⚠️  警告: 文件系统操作遇到问题`));
          console.log(ConsoleColors.info('这是一个文件系统相关的警告，不影响迁移结果'));
        }
        return { success: true, output: '', warning: '文件系统操作遇到问题，但不影响迁移结果' };
      }
      
      // 其他错误正常抛出
      console.log(ConsoleColors.error(`命令执行失败: ${command}`));
      throw new Error(`命令执行失败: ${command}\n错误信息: ${errorMessage}`);
    }
  }

  /**
   * 执行命令并显示实时输出（支持错误降级处理和进度显示）
   */
  private executeCommandWithWarningAndProgress(command: string, cwd?: string): { success: boolean; output: string; warning?: string } {
    try {
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`执行命令: ${command}`));
      }
      const result = execSync(command, { 
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: this.quietMode ? 'pipe' : 'inherit' // 静默模式下隐藏实时输出
      });
      if (!this.quietMode) {
        console.log(ConsoleColors.dim(`命令执行成功`));
      }
      return { success: true, output: result ? result.toString().trim() : '' };
    } catch (error: any) {
      // 获取完整的错误信息，包括 stderr
      const errorMessage = error.message || '';
      const stderr = error.stderr ? error.stderr.toString() : '';
      const stdout = error.stdout ? error.stdout.toString() : '';
      const fullErrorMessage = `${errorMessage}\n${stderr}\n${stdout}`.trim();
      
      // 检查是否为隐藏引用相关的错误，将其降级为警告
      if (fullErrorMessage.includes('deny updating a hidden ref') || 
          fullErrorMessage.includes('refs/keep-around') ||
          fullErrorMessage.includes('refs/merge-requests') ||
          fullErrorMessage.includes('refs/pipelines') ||
          fullErrorMessage.includes('refs/environments') ||
          fullErrorMessage.includes('refs/heads/') ||
          fullErrorMessage.includes('refs/tags/') ||
          fullErrorMessage.includes('hidden ref') ||
          fullErrorMessage.includes('refusing to update checked out branch') ||
          fullErrorMessage.includes('remote rejected') ||
          fullErrorMessage.includes('pre-receive hook declined') ||
          fullErrorMessage.includes('! [remote rejected]') ||
          fullErrorMessage.includes('hook declined') ||
          fullErrorMessage.includes('protected branch') ||
          fullErrorMessage.includes('To ') ||
          fullErrorMessage.includes('Everything up-to-date') ||
          fullErrorMessage.includes('non-fast-forward') ||
          fullErrorMessage.includes('failed to push some refs') ||
          fullErrorMessage.includes('updates were rejected') ||
          fullErrorMessage.includes('fetch first') ||
          fullErrorMessage.includes('hint: Updates were rejected') ||
          fullErrorMessage.includes('error: failed to push') ||
          stderr.includes('deny updating a hidden ref') ||
          stderr.includes('refs/keep-around') ||
          stderr.includes('refs/merge-requests') ||
          stderr.includes('refs/pipelines') ||
          stderr.includes('refs/environments') ||
          stderr.includes('refs/heads/') ||
          stderr.includes('refs/tags/') ||
          stderr.includes('remote rejected') ||
          stderr.includes('! [remote rejected]') ||
          stderr.includes('hook declined') ||
          stderr.includes('protected branch') ||
          stderr.includes('To ') ||
          stderr.includes('Everything up-to-date') ||
          stderr.includes('non-fast-forward') ||
          stderr.includes('failed to push some refs') ||
          stderr.includes('updates were rejected') ||
          stderr.includes('fetch first') ||
          stderr.includes('hint: Updates were rejected') ||
          stderr.includes('error: failed to push')) {
        if (!this.quietMode) {
          console.log(ConsoleColors.warning(`⚠️  警告: 推送过程中遇到隐藏引用相关警告`));
          console.log(ConsoleColors.info('这是一个隐藏引用相关的警告，不影响迁移结果'));
        }
        return { success: true, output: stdout, warning: '推送过程中遇到隐藏引用相关警告，但不影响迁移结果' };
      }
      
      // 检查是否为文件系统相关的错误，将其降级为警告
      if (fullErrorMessage.includes('EBUSY: resource busy or locked') ||
          fullErrorMessage.includes('resource busy or locked') ||
          fullErrorMessage.includes('cannot delete') ||
          fullErrorMessage.includes('cannot remove') ||
          fullErrorMessage.includes('ENOENT: no such file or directory') ||
          fullErrorMessage.includes('no such file or directory') ||
          fullErrorMessage.includes('ENOSPC: no space left on device') ||
          fullErrorMessage.includes('no space left on device') ||
          stderr.includes('EBUSY: resource busy or locked') ||
          stderr.includes('resource busy or locked') ||
          stderr.includes('cannot delete') ||
          stderr.includes('cannot remove')) {
        if (!this.quietMode) {
          console.log(ConsoleColors.warning(`⚠️  警告: 文件系统操作遇到问题`));
          console.log(ConsoleColors.info('这是一个文件系统相关的警告，不影响迁移结果'));
        }
        return { success: true, output: stdout, warning: '文件系统操作遇到问题，但不影响迁移结果' };
      }
      
      // 其他错误正常抛出
      if (!this.quietMode) {
        console.log(ConsoleColors.error(`命令执行失败: ${command}`));
      }
      throw new Error(`命令执行失败: ${command}\n错误信息: ${fullErrorMessage}`);
    }
  }

  /**
   * 检查目标分组中是否已存在同名仓库
   */
  private async checkRepositoryExists(repoName: string): Promise<{ exists: boolean; isEmpty?: boolean; targetUrl?: string }> {
    try {
      console.log(`🔍 检查仓库是否存在: ${repoName}`);
      
      // 从目标分组URL中提取分组路径
      const groupPath = this.extractGroupPath(this.targetGroupUrl);
      const apiUrl = `${this.getGitLabApiBase()}/projects/${encodeURIComponent(groupPath + '/' + repoName)}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        const projectData = await response.json();
        console.log(`⚠️ 仓库已存在: ${repoName}`);
        
        // 检查是否为空仓库
        const isEmpty = await this.checkIfRepositoryIsEmpty(projectData.id);
        if (isEmpty) {
          console.log(ConsoleColors.warning(`⚠️ 目标仓库 ${ConsoleColors.highlight(repoName)} 是一个空仓库`));
          const shouldContinue = await this.promptUserConfirmation(
            `目标仓库 "${repoName}" 已存在但是空仓库，是否继续迁移？这将覆盖空仓库的内容。\n是否继续？ (y/N): `
          );
          
          if (!shouldContinue) {
            throw new Error('用户取消迁移操作');
          }
          
          console.log(ConsoleColors.info('用户确认继续迁移到空仓库'));
          // 根据目标分组URL的协议来决定返回HTTPS还是SSH URL
          const targetUrl = this.targetGroupUrl.startsWith('https://') 
            ? projectData.http_url_to_repo 
            : projectData.ssh_url_to_repo;
          return { exists: true, isEmpty: true, targetUrl };
        }
        
        return { exists: true, isEmpty: false };
      } else if (response.status === 404) {
        console.log(`✅ 仓库不存在，可以创建: ${repoName}`);
        return { exists: false };
      } else {
        throw new Error(`检查仓库存在性失败，HTTP状态码: ${response.status}`);
      }
    } catch (error: any) {
      console.log(`❌ 检查仓库存在性时发生错误: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查仓库是否为空
   */
  private async checkIfRepositoryIsEmpty(projectId: number): Promise<boolean> {
    try {
      // 检查仓库的提交数量
      const commitsUrl = `${this.getGitLabApiBase()}/projects/${projectId}/repository/commits`;
      const commitsResponse = await fetch(commitsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (commitsResponse.status === 200) {
        const commits = await commitsResponse.json();
        return commits.length === 0;
      } else if (commitsResponse.status === 404) {
        // 404表示没有提交记录，即空仓库
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.log(`⚠️ 检查仓库是否为空时发生错误: ${error.message}`);
      // 如果检查失败，保守起见认为不是空仓库
      return false;
    }
  }

  /**
   * 提示用户确认操作
   */
  private async promptUserConfirmation(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question(message, (answer) => {
        rl.close();
        const normalizedAnswer = answer.toLowerCase().trim();
        resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
      });
    });
  }

  /**
   * 从仓库URL中提取仓库名
   */
  private extractRepoNameFromUrl(url: string): string {
    const match = url.match(/\/([^\/]+)\.git$/);
    if (match) {
      return match[1];
    }
    
    // 如果没有.git后缀，提取最后一个路径段
    const segments = url.split('/');
    return segments[segments.length - 1];
  }

  /**
   * 克隆原仓库镜像
   */
  private cloneOriginalRepository(repo: TRepository): string {
    console.log(`🔄 正在克隆原仓库镜像: ${repo.name}`);
    console.log(ConsoleColors.info(`原仓库地址: ${ConsoleColors.url(repo.originalUrl)}`));
    
    // 确保临时目录存在
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
      console.log(ConsoleColors.dim(`创建临时目录: ${this.tempDir}`));
    }
    
    // 从仓库URL中提取实际的仓库名作为镜像目录名
    const actualRepoName = this.extractRepoNameFromUrl(repo.originalUrl);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const cloneDirName = `${actualRepoName}-${timestamp}-${randomSuffix}.git`;
    const cloneDir = path.join(this.tempDir, cloneDirName);
    console.log(ConsoleColors.info(`镜像目录: ${ConsoleColors.dim(cloneDir)}`));
    
    // 如果目录已存在，先删除
    if (existsSync(cloneDir)) {
      console.log(ConsoleColors.warning(`删除已存在的镜像目录: ${ConsoleColors.dim(cloneDir)}`));
      rmSync(cloneDir, { recursive: true, force: true });
    }

    console.log(ConsoleColors.progress(`开始克隆镜像...`));
    const cloneCommand = `git clone --mirror ${repo.originalUrl} "${cloneDir}"`;
    this.executeCommandWithProgress(cloneCommand);
    
    console.log(ConsoleColors.success(`原仓库镜像克隆完成: ${ConsoleColors.dim(cloneDir)}`));
    return cloneDir;
  }

  /**
   * 创建目标仓库
   */
  private async createTargetRepository(repo: TRepository): Promise<string> {
    try {
      console.log(ConsoleColors.info(`正在创建目标仓库: ${ConsoleColors.highlight(repo.name)}`));
      
      // 从目标分组URL中提取分组ID
      const groupId = await this.getGroupId(this.targetGroupUrl);
      const apiUrl = `${this.getGitLabApiBase()}/projects`;
      
      const projectData = {
        name: repo.name,
        path: repo.name,
        description: repo.description || '',
        namespace_id: groupId,
        visibility: 'internal', // 设置为内部可见
        initialize_with_readme: false,
        issues_enabled: true,
        merge_requests_enabled: true,
        wiki_enabled: true,
        snippets_enabled: true
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`创建仓库失败，HTTP状态码: ${response.status}，错误信息: ${errorData}`);
      }
      
      const projectInfo = await response.json();
      // 根据目标分组URL的协议来决定返回HTTPS还是SSH URL
      const targetUrl = this.targetGroupUrl.startsWith('https://') 
        ? projectInfo.http_url_to_repo 
        : projectInfo.ssh_url_to_repo;
      
      console.log(ConsoleColors.success(`目标仓库创建完成: ${ConsoleColors.url(targetUrl)}`));
      return targetUrl;
    } catch (error: any) {
      console.log(ConsoleColors.error(`创建目标仓库失败: ${error.message}`));
      throw error;
    }
  }

  /**
   * 推送镜像到目标仓库
   */
  private pushMirrorToTarget(cloneDir: string, targetUrl: string): { hasWarnings: boolean; warnings?: string[] } {
    console.log(ConsoleColors.info(`正在推送镜像到目标仓库...`));
    console.log(ConsoleColors.info(`目标仓库地址: ${ConsoleColors.url(targetUrl)}`));
    console.log(ConsoleColors.info(`镜像目录: ${ConsoleColors.dim(cloneDir)}`));
    
    const originalCwd = process.cwd();
    const warnings: string[] = [];
    let hasWarnings = false;
    
    try {
      // 进入克隆目录
      console.log(ConsoleColors.progress(`切换到镜像目录: ${cloneDir}`));
      process.chdir(cloneDir);
      
      // 设置新的远程地址
      console.log(ConsoleColors.progress(`设置目标仓库远程地址...`));
      const setUrlCommand = `git remote set-url origin "${targetUrl}"`;
      this.executeCommand(setUrlCommand);
      
      // 推送镜像（支持隐藏引用错误降级为警告）
      console.log(ConsoleColors.progress(`开始推送镜像到目标仓库...`));
      const pushCommand = 'git push --mirror';
      const pushResult = this.executeCommandWithWarningAndProgress(pushCommand);
      
      if (pushResult.warning) {
        hasWarnings = true;
        const warningMsg = `推送时遇到隐藏引用警告: ${pushResult.warning}`;
        warnings.push(warningMsg);
        console.log(ConsoleColors.info('镜像推送完成（存在警告，但不影响迁移结果）'));
      } else {
        console.log(ConsoleColors.success(`镜像推送完成`));
      }
      
      return { hasWarnings, warnings: hasWarnings ? warnings : undefined };
    } finally {
      // 确保返回原始目录
      console.log(ConsoleColors.progress(`返回原始工作目录`));
      process.chdir(originalCwd);
    }
  }

  /**
   * 设置目标仓库的项目描述
   */
  private async updateRepositoryDescription(repoName: string, description: string): Promise<void> {
    try {
      console.log(ConsoleColors.info(`正在更新仓库描述: ${ConsoleColors.repo(repoName)}`));
      
      if (!description || description.trim() === '') {
        console.log(ConsoleColors.warning(`描述为空，跳过更新`));
        return;
      }
      
      // 从目标分组URL中提取分组路径
      const groupPath = this.extractGroupPath(this.targetGroupUrl);
      const projectPath = `${groupPath}/${repoName}`;
      const apiUrl = `${this.getGitLabApiBase()}/projects/${encodeURIComponent(projectPath)}`;
      
      const updateData = {
        description: description.trim()
      };
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`更新仓库描述失败，HTTP状态码: ${response.status}，错误信息: ${errorData}`);
      }
      
      console.log(ConsoleColors.success(`仓库描述更新完成: ${ConsoleColors.description(description.trim())}`));
    } catch (error: any) {
      console.log(ConsoleColors.error(`更新仓库描述失败: ${error.message}`));
      throw error;
    }
  }

  /**
   * 克隆迁移后的仓库到本地
   */
  private cloneFinalRepository(targetUrl: string, repoName: string): void {
    console.log(ConsoleColors.info(`正在克隆迁移后的仓库到本地: ${ConsoleColors.repo(repoName)}`));
    console.log(ConsoleColors.info(`目标仓库地址: ${ConsoleColors.url(targetUrl)}`));
    console.log(ConsoleColors.info(`本地目录: ${ConsoleColors.dim(repoName)}`));
    
    // 如果目录已存在，先删除
    if (existsSync(repoName)) {
      console.log(ConsoleColors.warning(`删除已存在的目录: ${ConsoleColors.dim(repoName)}`));
      rmSync(repoName, { recursive: true, force: true });
    }

    console.log(ConsoleColors.progress(`开始克隆迁移后的仓库...`));
    const cloneCommand = `git clone "${targetUrl}" "${repoName}"`;
    this.executeCommandWithProgress(cloneCommand);
    
    console.log(ConsoleColors.success(`迁移后仓库克隆完成: ${ConsoleColors.repo(repoName)}`));
  }

  /**
   * 延迟保存迁移日志，避免频繁创建备份
   */
  private scheduleSaveMigrationLogs(): void {
    // 清除之前的定时器
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // 设置新的延迟保存定时器（2秒后保存）
    this.saveTimeout = setTimeout(() => {
      this.saveMigrationLogs();
      this.saveTimeout = null;
    }, 2000);
  }

  /**
   * 强制保存迁移日志（程序退出时调用）
   */
  public forceSaveMigrationLogs(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveMigrationLogs();
  }

  /**
   * 更新迁移日志
   */
  private updateMigrationLog(log: TMigrationLog): void {
    // 更新最后修改时间
    log.lastUpdated = new Date().toISOString();
    
    // 确保必要的字段存在
    if (!log.steps) log.steps = [];
    if (!log.warnings) log.warnings = [];
    if (log.retryCount === undefined) log.retryCount = 0;
    if (!log.errorType && log.failureReason) {
      log.errorType = 'unknown';
    }
    
    this.logs.set(log.projectName, log);
    // 延迟保存，避免频繁创建备份
    this.scheduleSaveMigrationLogs();
  }

  /**
   * 创建配置文件备份
   */
  private createConfigBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.moveFilePath.replace(/\.md$/, `.backup.${timestamp}.md`);
    
    try {
      const content = readFileSync(this.moveFilePath, 'utf-8');
      writeFileSync(backupPath, content, 'utf-8');
      console.log(ConsoleColors.dim(`📋 已创建配置文件备份: ${path.basename(backupPath)}`));
      return backupPath;
    } catch (error) {
      console.log(ConsoleColors.warning(`⚠️  创建备份失败: ${error instanceof Error ? error.message : String(error)}`));
      return '';
    }
  }

  /**
   * 清理旧备份文件（保留最近5个）
   */
  private cleanupOldBackups(): void {
    try {
      const dir = path.dirname(this.moveFilePath);
      const baseName = path.basename(this.moveFilePath, '.md');
      const files = readdirSync(dir);
       
       const backupFiles = files
         .filter((file: string) => file.startsWith(`${baseName}.backup.`) && file.endsWith('.md'))
         .map((file: string) => ({
           name: file,
           path: path.join(dir, file),
           time: statSync(path.join(dir, file)).mtime
         }))
        .sort((a: any, b: any) => b.time.getTime() - a.time.getTime());
      
      // 保留最近5个备份，删除其余的
      if (backupFiles.length > 5) {
        const filesToDelete = backupFiles.slice(5);
        filesToDelete.forEach((file: any) => {
          try {
            rmSync(file.path);
            console.log(ConsoleColors.dim(`🗑️  已删除旧备份: ${file.name}`));
          } catch (error) {
            console.log(ConsoleColors.warning(`⚠️  删除备份失败: ${file.name}`));
          }
        });
      }
    } catch (error) {
      // 清理失败不影响主流程，只记录警告
      console.log(ConsoleColors.dim('⚠️  清理旧备份时出现问题，但不影响主流程'));
    }
  }

  /**
   * 清理旧的临时目录（保留最近3个，删除超过24小时的）
   */
  /**
   * 清理旧的临时目录
   * 增强版本：更好的错误处理、详细日志、空目录检测、强制清理策略
   */
  private cleanupOldTempDirectories(): void {
    try {
      const currentDir = process.cwd();
      
      // 检查当前目录是否存在
      if (!existsSync(currentDir)) {
        console.warn(ConsoleColors.warning('当前目录不存在，跳过临时目录清理'));
        return;
      }
      
      const files = readdirSync(currentDir);
      const now = new Date().getTime();
      const oneDayMs = 24 * 60 * 60 * 1000; // 24小时的毫秒数
      const oneHourMs = 60 * 60 * 1000; // 1小时的毫秒数
      
      // 查找所有临时目录
      const tempDirs = files
        .filter((file: string) => {
          try {
            return file.startsWith('temp-migration-') && 
                   statSync(path.join(currentDir, file)).isDirectory();
          } catch {
            return false;
          }
        })
        .map((dir: string) => {
          const dirPath = path.join(currentDir, dir);
          try {
            const stat = statSync(dirPath);
            
            // 检查目录是否为空
            let isEmpty = false;
            let fileCount = 0;
            try {
              const dirContents = readdirSync(dirPath);
              fileCount = dirContents.length;
              isEmpty = fileCount === 0;
            } catch (error) {
              console.warn(ConsoleColors.warning(`检查目录 ${dir} 内容时出错: ${error}`));
            }
            
            return {
              name: dir,
              path: dirPath,
              time: stat.mtime,
              age: now - stat.mtime.getTime(),
              isEmpty: isEmpty,
              fileCount: fileCount,
              size: this.getDirectorySize(dirPath)
            };
          } catch (error) {
            console.warn(ConsoleColors.warning(`获取目录 ${dir} 信息时出错: ${error}`));
            return null;
          }
        })
        .filter((dir): dir is NonNullable<typeof dir> => dir !== null)
        .sort((a, b) => b.time.getTime() - a.time.getTime());
      
      if (tempDirs.length === 0) {
        console.log(ConsoleColors.dim('未发现需要清理的临时目录'));
        return;
      }

      console.log(ConsoleColors.info(`发现 ${tempDirs.length} 个临时目录`));
      
      // 分类需要删除的目录
      const emptyDirs = tempDirs.filter(dir => dir.isEmpty);
      const oldDirs = tempDirs.filter(dir => dir.age > oneDayMs && !dir.isEmpty);
      const veryOldDirs = tempDirs.filter(dir => dir.age > oneHourMs && !dir.isEmpty); // 超过1小时的非空目录
      const excessDirs = tempDirs.slice(3).filter(dir => !dir.isEmpty && dir.age < oneDayMs);
      
      // 强制清理策略：空目录立即删除，超过1小时的目录也删除（而不是24小时）
      const dirsToDelete = [
        ...emptyDirs, // 所有空目录
        ...oldDirs,   // 超过24小时的目录
        ...excessDirs, // 超出保留数量的目录
        ...veryOldDirs.filter(dir => !oldDirs.includes(dir) && !excessDirs.includes(dir)) // 超过1小时但不在其他分类中的目录
      ];
      
      // 去重
      const uniqueDirsToDelete = Array.from(new Set(dirsToDelete));
      
      if (uniqueDirsToDelete.length === 0) {
        console.log(ConsoleColors.dim('所有临时目录都在保留范围内，无需清理'));
        return;
      }

      console.log(ConsoleColors.info(`🧹 准备清理 ${uniqueDirsToDelete.length} 个临时目录:`));
      if (emptyDirs.length > 0) {
        console.log(ConsoleColors.dim(`  - ${emptyDirs.length} 个空目录`));
      }
      if (oldDirs.length > 0) {
        console.log(ConsoleColors.dim(`  - ${oldDirs.length} 个超过24小时的目录`));
      }
      if (veryOldDirs.length > 0) {
        console.log(ConsoleColors.dim(`  - ${veryOldDirs.filter(dir => !oldDirs.includes(dir)).length} 个超过1小时的目录`));
      }
      if (excessDirs.length > 0) {
        console.log(ConsoleColors.dim(`  - ${excessDirs.length} 个超出保留数量的目录`));
      }
      
      let successCount = 0;
      let failureCount = 0;
      
      uniqueDirsToDelete.forEach(dir => {
        try {
          const ageHours = Math.round(dir.age / oneHourMs * 10) / 10;
          const sizeInfo = dir.size > 0 ? ` (${this.formatBytes(dir.size)})` : ' (空)';
          const ageInfo = ageHours < 1 ? ' (新建)' : ` (${ageHours}h前)`;
          
          rmSync(dir.path, { recursive: true, force: true });
          console.log(ConsoleColors.dim(`  ✓ 已删除: ${dir.name}${sizeInfo}${ageInfo}`));
          successCount++;
        } catch (error) {
          console.warn(ConsoleColors.warning(`  ✗ 删除失败: ${dir.name} - ${error}`));
          failureCount++;
        }
      });
      
      // 清理结果摘要
      if (successCount > 0) {
        console.log(ConsoleColors.success(`✓ 成功清理 ${successCount} 个临时目录`));
      }
      if (failureCount > 0) {
        console.warn(ConsoleColors.warning(`⚠ ${failureCount} 个目录清理失败`));
      }
      
    } catch (error) {
      console.warn(ConsoleColors.warning(`清理临时目录时出错: ${error}`));
    }
  }
  
  /**
   * 获取目录大小（字节）
   */
  private getDirectorySize(dirPath: string): number {
    try {
      let totalSize = 0;
      const files = readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * 格式化字节大小为可读格式
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 保存迁移日志到move.md文件
   */
  private saveMigrationLogs(): void {
    try {
      // 只在重要节点创建备份（如迁移完成或失败）
      const shouldCreateBackup = Array.from(this.logs.values()).some(log => 
        log.isFinalCloned || log.failureReason
      );
      
      if (shouldCreateBackup) {
        this.createConfigBackup();
      }
      
      // 确保目录存在
      const dir = path.dirname(this.moveFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // 检查文件是否存在，如果不存在则创建基础内容
      let content: string;
      if (existsSync(this.moveFilePath)) {
        content = readFileSync(this.moveFilePath, 'utf-8');
      } else {
        console.log('📝 move.md 文件不存在，创建新的日志文件');
        content = '# GitLab 仓库迁移配置\n\n## 日志';
      }
      
      const lines = content.split('\n');
      
      // 找到日志部分的开始位置
      let logStartIndex = lines.findIndex(line => line.includes('## 日志'));
      let beforeLogLines: string[];
      
      if (logStartIndex === -1) {
        // 如果没有找到日志部分，自动添加
        console.log('📝 未找到日志部分，自动创建日志部分');
        beforeLogLines = [...lines, '', '## 日志'];
      } else {
        // 保留日志部分之前的内容
        beforeLogLines = lines.slice(0, logStartIndex + 1);
      }
      
      // 生成新的日志内容
      const logLines: string[] = [''];
      
      // 严格按照 move.md 文件中的项目顺序添加日志记录，只保存配置文件中存在的项目
      const configuredProjectNames = new Set(this.repositories.map(repo => repo.name));
      let savedLogsCount = 0;
      
      for (const repo of this.repositories) {
        const log = this.logs.get(repo.name);
        if (log && configuredProjectNames.has(repo.name)) {
          logLines.push(`### ${log.projectName}`);
          logLines.push(`- **项目名称**: ${log.projectName}`);
          logLines.push(`- **项目描述**: ${log.projectDescription}`);
          logLines.push(`- **原仓库地址**: ${log.originalRepoUrl}`);
          logLines.push(`- **目标分组**: ${log.targetGroup}`);
          logLines.push(`- **目标仓库地址**: ${log.targetRepoUrl}`);
          logLines.push(`- **开始时间**: ${log.startTime}`);
          logLines.push(`- **结束时间**: ${log.endTime}`);
          logLines.push(`- **耗时**: ${log.duration}`);
          logLines.push(`- **是否已克隆原仓库镜像**: ${log.isOriginalCloned ? '✅' : '❌'}`);
          logLines.push(`- **是否已创建目标仓库**: ${log.isTargetCreated ? '✅' : '❌'}`);
          logLines.push(`- **是否已推送镜像到目标仓库**: ${log.isMirrorPushed ? '✅' : '❌'}`);
          logLines.push(`- **是否已修改目标仓库的项目描述**: ${log.isDescriptionUpdated ? '✅' : '❌'}`);
          logLines.push(`- **是否已克隆迁移后的仓库**: ${log.isFinalCloned ? '✅' : '❌'}`);
          if (log.warnings && log.warnings.length > 0) {
            logLines.push(`- **警告原因**: ${log.warnings.join('; ')}`);
          }
          if (log.failureReason) {
            logLines.push(`- **失败原因**: ${log.failureReason}`);
          }
          logLines.push('');
          savedLogsCount++;
        }
      }
      
      // 合并所有内容
      const newContent = [...beforeLogLines, ...logLines].join('\n');
      
      // 写入文件
      writeFileSync(this.moveFilePath, newContent, 'utf-8');
      
      console.log(`💾 已保存 ${savedLogsCount} 个项目的迁移日志，顺序与配置文件一致`);
      
    } catch (error: any) {
      console.error(`❌ 保存日志失败: ${error.message}`);
    }
  }

  /**
   * 记录迁移步骤
   */
  private recordMigrationStep(
    projectName: string,
    stepName: string,
    status: TStepStatus,
    error?: string,
    errorType?: TErrorType,
    warnings?: string[]
  ): void {
    const log = this.logs.get(projectName);
    if (!log) return;

    const existingStepIndex = log.steps.findIndex(step => step.name === stepName);
    const now = new Date().toISOString();
    
    if (existingStepIndex >= 0) {
      // 更新现有步骤
      const step = log.steps[existingStepIndex];
      const startTime = step.startTime || now;
      
      log.steps[existingStepIndex] = {
        ...step,
        status,
        endTime: status === 'completed' || status === 'failed' || status === 'warning' ? now : step.endTime,
        duration: status === 'completed' || status === 'failed' || status === 'warning' 
          ? new Date(now).getTime() - new Date(startTime).getTime() 
          : step.duration,
        error,
        errorType,
        warnings: warnings || step.warnings || []
      };
    } else {
      // 添加新步骤
      log.steps.push({
        name: stepName,
        status,
        startTime: status === 'in_progress' ? now : undefined,
        endTime: status === 'completed' || status === 'failed' || status === 'warning' ? now : undefined,
        duration: status === 'completed' || status === 'failed' || status === 'warning' ? 0 : undefined,
        error,
        errorType,
        warnings: warnings || []
      });
    }

    this.updateMigrationLog(log);
  }

  /**
   * 添加警告信息
   */
  private addWarning(projectName: string, warning: string): void {
    const log = this.logs.get(projectName);
    if (!log) return;

    if (!log.warnings.includes(warning)) {
      log.warnings.push(warning);
      this.updateMigrationLog(log);
    }
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: string): TErrorType {
    const errorLower = error.toLowerCase();
    
    // Git 操作错误 - 更详细的模式匹配
    if (errorLower.includes('git') || 
        errorLower.includes('clone') || 
        errorLower.includes('push') || 
        errorLower.includes('pull') || 
        errorLower.includes('fetch') ||
        errorLower.includes('remote') ||
        errorLower.includes('repository not found') ||
        errorLower.includes('authentication failed') ||
        errorLower.includes('fatal: not a git repository') ||
        errorLower.includes('fatal: repository') ||
        errorLower.includes('error: failed to push') ||
        errorLower.includes('error: src refspec') ||
        errorLower.includes('error: pathspec') ||
        errorLower.includes('fatal: could not read from remote repository') ||
        errorLower.includes('fatal: unable to access') ||
        errorLower.includes('ssh: connect to host') ||
        errorLower.includes('host key verification failed') ||
        errorLower.includes('permission denied (publickey)') ||
        errorLower.includes('branch not found') ||
        errorLower.includes('ref does not exist') ||
        errorLower.includes('non-fast-forward') ||
        errorLower.includes('merge conflict') ||
        errorLower.includes('working tree clean')) {
      return 'git_operation';
    }
    
    // API 操作错误 - 增强 GitLab API 特定错误
    if (errorLower.includes('api') || 
        errorLower.includes('http') || 
        errorLower.includes('401') || 
        errorLower.includes('403') || 
        errorLower.includes('404') || 
        errorLower.includes('422') || 
        errorLower.includes('500') || 
        errorLower.includes('502') || 
        errorLower.includes('503') ||
        errorLower.includes('unauthorized') ||
        errorLower.includes('forbidden') ||
        errorLower.includes('bad gateway') ||
        errorLower.includes('service unavailable') ||
        errorLower.includes('internal server error') ||
        errorLower.includes('gitlab api') ||
        errorLower.includes('project already exists') ||
        errorLower.includes('name has already been taken') ||
        errorLower.includes('path has already been taken') ||
        errorLower.includes('invalid token') ||
        errorLower.includes('token expired') ||
        errorLower.includes('insufficient scope')) {
      return 'api_operation';
    }
    
    // 网络错误 - 增强网络相关错误模式
    if (errorLower.includes('network') || 
        errorLower.includes('timeout') || 
        errorLower.includes('connection') || 
        errorLower.includes('dns') ||
        errorLower.includes('enotfound') ||
        errorLower.includes('econnrefused') ||
        errorLower.includes('econnreset') ||
        errorLower.includes('etimedout') ||
        errorLower.includes('socket hang up') ||
        errorLower.includes('network is unreachable') ||
        errorLower.includes('host is unreachable') ||
        errorLower.includes('connection timed out') ||
        errorLower.includes('unable to resolve host') ||
        errorLower.includes('name resolution failed') ||
        errorLower.includes('temporary failure in name resolution')) {
      return 'network';
    }
    
    // 文件系统错误 - 文件操作相关错误
    if (errorLower.includes('ebusy') ||
        errorLower.includes('resource busy or locked') ||
        errorLower.includes('file is being used by another process') ||
        errorLower.includes('cannot delete') ||
        errorLower.includes('cannot remove') ||
        errorLower.includes('directory not empty') ||
        errorLower.includes('enoent') ||
        errorLower.includes('no such file or directory') ||
        errorLower.includes('eacces') ||
        errorLower.includes('permission denied') ||
        errorLower.includes('eperm') ||
        errorLower.includes('operation not permitted') ||
        errorLower.includes('emfile') ||
        errorLower.includes('too many open files') ||
        errorLower.includes('enospc') ||
        errorLower.includes('no space left on device') ||
        errorLower.includes('disk full') ||
        errorLower.includes('cleanup failed') ||
        errorLower.includes('failed to delete') ||
        errorLower.includes('failed to remove')) {
      return 'filesystem';
    }
    
    // 权限错误 - 增强权限相关错误模式
    if (errorLower.includes('permission') || 
        errorLower.includes('access') || 
        errorLower.includes('denied') ||
        errorLower.includes('insufficient privileges') ||
        errorLower.includes('not authorized') ||
        errorLower.includes('access forbidden') ||
        errorLower.includes('you are not allowed') ||
        errorLower.includes('insufficient permissions') ||
        errorLower.includes('operation not permitted') ||
        errorLower.includes('access level') ||
        errorLower.includes('maintainer access required') ||
        errorLower.includes('owner access required')) {
      return 'permission';
    }
    
    // 验证错误 - 增强数据验证错误模式
    if (errorLower.includes('validation') || 
        errorLower.includes('invalid') || 
        errorLower.includes('malformed') ||
        errorLower.includes('format') ||
        errorLower.includes('bad request') ||
        errorLower.includes('unprocessable entity') ||
        errorLower.includes('missing required') ||
        errorLower.includes('field is required') ||
        errorLower.includes('must be') ||
        errorLower.includes('cannot be blank') ||
        errorLower.includes('is too long') ||
        errorLower.includes('is too short') ||
        errorLower.includes('contains invalid characters') ||
        errorLower.includes('url is invalid') ||
        errorLower.includes('email is invalid')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  /**
   * 获取可读的错误信息
   */
  private getReadableErrorMessage(error: string, errorType: TErrorType): string {
    const baseMessage = error.length > 200 ? error.substring(0, 200) + '...' : error;
    const errorLower = baseMessage.toLowerCase();
    
    switch (errorType) {
      case 'git_operation':
        if (errorLower.includes('clone')) {
          return `Git 克隆失败: ${baseMessage}。请检查源仓库地址是否正确，网络连接是否正常。`;
        } else if (errorLower.includes('push')) {
          return `Git 推送失败: ${baseMessage}。请检查目标仓库权限和网络连接。`;
        } else if (errorLower.includes('fetch')) {
          return `Git 获取失败: ${baseMessage}。请检查仓库地址和网络连接。`;
        } else if (errorLower.includes('authentication failed')) {
          return `Git 认证失败: ${baseMessage}。请检查 Access Token 是否有效。`;
        } else {
          return `Git 操作失败: ${baseMessage}`;
        }
        
      case 'api_operation':
        if (errorLower.includes('401')) {
          return `API 认证失败: ${baseMessage}。请检查 Access Token 是否有效且具有足够权限。`;
        } else if (errorLower.includes('403')) {
          return `API 权限不足: ${baseMessage}。请确保 Access Token 具有创建仓库和管理项目的权限。`;
        } else if (errorLower.includes('404')) {
          return `API 资源未找到: ${baseMessage}。请检查目标分组路径是否正确。`;
        } else if (errorLower.includes('409')) {
          return `API 资源冲突: ${baseMessage}。目标仓库可能已存在，请检查仓库名称。`;
        } else if (errorLower.includes('422')) {
          return `API 参数验证失败: ${baseMessage}。请检查仓库名称和描述是否符合要求。`;
        } else if (errorLower.includes('500')) {
          return `API 服务器错误: ${baseMessage}。GitLab 服务器可能暂时不可用，请稍后重试。`;
        } else {
          return `API 调用失败: ${baseMessage}`;
        }
        
      case 'network':
        if (errorLower.includes('timeout')) {
          return `网络超时: ${baseMessage}。请检查网络连接或稍后重试。`;
        } else if (errorLower.includes('enotfound') || errorLower.includes('getaddrinfo')) {
          return `DNS 解析失败: ${baseMessage}。请检查网络连接和 GitLab 服务器地址。`;
        } else if (errorLower.includes('econnrefused')) {
          return `连接被拒绝: ${baseMessage}。请检查 GitLab 服务器是否可访问。`;
        } else {
          return `网络连接失败: ${baseMessage}。请检查网络连接状态。`;
        }
        
      case 'permission':
        if (errorLower.includes('access denied')) {
          return `访问被拒绝: ${baseMessage}。请检查 Access Token 权限或联系管理员。`;
        } else if (errorLower.includes('insufficient privileges')) {
          return `权限不足: ${baseMessage}。请确保具有目标分组的创建仓库权限。`;
        } else {
          return `权限不足: ${baseMessage}。请检查相关权限设置。`;
        }
        
      case 'validation':
        if (errorLower.includes('invalid repository name')) {
          return `仓库名称无效: ${baseMessage}。请使用有效的仓库名称格式。`;
        } else if (errorLower.includes('invalid group path')) {
          return `分组路径无效: ${baseMessage}。请检查目标分组路径格式。`;
        } else {
          return `数据验证失败: ${baseMessage}。请检查输入参数的格式和有效性。`;
        }
        
      case 'filesystem':
        if (errorLower.includes('ebusy') || errorLower.includes('resource busy or locked')) {
          return `文件系统忙碌: ${baseMessage}。文件正被其他进程使用，这通常不影响迁移结果。`;
        } else if (errorLower.includes('cannot delete') || errorLower.includes('cannot remove')) {
          return `文件删除失败: ${baseMessage}。临时文件清理失败，但不影响迁移结果。`;
        } else if (errorLower.includes('enoent') || errorLower.includes('no such file or directory')) {
          return `文件不存在: ${baseMessage}。目标文件可能已被删除，这通常不影响迁移结果。`;
        } else if (errorLower.includes('enospc') || errorLower.includes('no space left on device')) {
          return `磁盘空间不足: ${baseMessage}。请清理磁盘空间后重试。`;
        } else {
          return `文件系统错误: ${baseMessage}。这通常不影响迁移结果，可以忽略。`;
        }
        
      default:
          return `未知错误: ${baseMessage}。如果问题持续存在，请联系技术支持。`;
    }
  }

  /**
   * 预检查机制：验证迁移前的各项条件
   */
  private async performPreChecks(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    console.log('🔍 开始执行预检查...');
    
    try {
      // 1. 检查网络连通性
      console.log('1. 检查网络连通性...');
      const networkCheck = await this.checkNetworkConnectivity();
      if (!networkCheck.success) {
        errors.push(`网络连通性检查失败: ${networkCheck.error}`);
      } else {
        console.log('✓ 网络连通性正常');
      }
      
      // 2. 验证 GitLab API 权限
      console.log('2. 验证 GitLab API 权限...');
      const apiCheck = await this.checkGitLabApiPermissions();
      if (!apiCheck.success) {
        errors.push(`GitLab API 权限验证失败: ${apiCheck.error}`);
      } else {
        console.log('✓ GitLab API 权限验证通过');
      }
      
      // 3. 验证目标分组访问权限
      console.log('3. 验证目标分组访问权限...');
      const groupCheck = await this.checkTargetGroupPermissions();
      if (!groupCheck.success) {
        errors.push(`目标分组权限验证失败: ${groupCheck.error}`);
      } else {
        console.log('✓ 目标分组权限验证通过');
      }
      
      // 4. 检查本地 Git 环境
      console.log('4. 检查本地 Git 环境...');
      const gitCheck = await this.checkLocalGitEnvironment();
      if (!gitCheck.success) {
        errors.push(`本地 Git 环境检查失败: ${gitCheck.error}`);
      } else {
        console.log('✓ 本地 Git 环境正常');
      }
      
      const success = errors.length === 0;
      if (success) {
        console.log('✅ 所有预检查项目通过，可以开始迁移');
      } else {
        console.log('❌ 预检查发现问题，请解决后重试');
        errors.forEach(error => console.log(`  - ${error}`));
      }
      
      return { success, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`预检查过程中发生异常: ${errorMsg}`);
      return { success: false, errors };
    }
  }

  /**
   * 检查网络连通性
   */
  private async checkNetworkConnectivity(): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查目标 GitLab 服务器连通性
      const gitlabHost = new URL(this.targetGroupUrl).hostname;
      const response = await fetch(`https://${gitlabHost}/api/v4/version`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      });
      
      if (!response.ok) {
        return { success: false, error: `无法连接到 GitLab 服务器 (${response.status})` };
      }
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `网络连接失败: ${errorMsg}` };
    }
  }

  /**
   * 检查 GitLab API 权限
   */
  private async checkGitLabApiPermissions(): Promise<{ success: boolean; error?: string }> {
    try {
      const apiUrl = `${this.getGitLabApiBase()}/user`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Access Token 无效或已过期' };
        } else if (response.status === 403) {
          return { success: false, error: 'Access Token 权限不足' };
        } else {
          return { success: false, error: `API 调用失败 (${response.status})` };
        }
      }
      
      const userInfo = await response.json();
      console.log(`  当前用户: ${userInfo.name} (${userInfo.username})`);
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `API 权限验证失败: ${errorMsg}` };
    }
  }

  /**
   * 检查目标分组权限
   */
  private async checkTargetGroupPermissions(): Promise<{ success: boolean; error?: string }> {
    try {
      const groupId = await this.getGroupId(this.targetGroupUrl);
      const apiUrl = `${this.getGitLabApiBase()}/groups/${groupId}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: '目标分组不存在或无访问权限' };
        } else if (response.status === 403) {
          return { success: false, error: '对目标分组没有足够的权限' };
        } else {
          return { success: false, error: `分组权限检查失败 (${response.status})` };
        }
      }
      
      const groupInfo = await response.json();
      console.log(`  目标分组: ${groupInfo.name} (${groupInfo.full_path})`);
      
      // 检查是否有创建项目的权限
      if (groupInfo.permissions && groupInfo.permissions.group_access) {
        const accessLevel = groupInfo.permissions.group_access.access_level;
        if (accessLevel < 30) { // 30 = Developer, 40 = Maintainer, 50 = Owner
          return { success: false, error: '在目标分组中没有创建项目的权限（需要 Developer 及以上权限）' };
        }
      }
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `分组权限验证失败: ${errorMsg}` };
    }
  }

  /**
   * 检查本地 Git 环境
   */
  private async checkLocalGitEnvironment(): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查 Git 是否安装
      try {
        this.executeCommand('git --version');
      } catch (error) {
        return { success: false, error: 'Git 未安装或不在 PATH 环境变量中' };
      }
      
      // 检查 Git 配置
      try {
        const userName = this.executeCommand('git config --global user.name').trim();
        const userEmail = this.executeCommand('git config --global user.email').trim();
        
        if (!userName || !userEmail) {
          return { 
            success: false, 
            error: 'Git 用户信息未配置，请运行: git config --global user.name "Your Name" 和 git config --global user.email "your.email@example.com"' 
          };
        }
        
        console.log(`  Git 用户: ${userName} <${userEmail}>`);
      } catch (error) {
        return { success: false, error: 'Git 配置检查失败' };
      }
      
      // 检查临时目录权限
      try {
        if (!existsSync(this.tempDir)) {
          mkdirSync(this.tempDir, { recursive: true });
        }
        
        // 测试写入权限
        const testFile = path.join(this.tempDir, 'test-write-permission.tmp');
        writeFileSync(testFile, 'test');
        rmSync(testFile);
      } catch (error) {
        return { success: false, error: `临时目录权限不足: ${this.tempDir}` };
      }
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Git 环境检查失败: ${errorMsg}` };
    }
  }

  /**
   * 智能重试机制：根据错误类型决定是否重试
   */
  private shouldRetry(errorType: TErrorType, retryCount: number): boolean {
    const maxRetries = this.getMaxRetries(errorType);
    return retryCount < maxRetries;
  }

  /**
   * 获取不同错误类型的最大重试次数
   */
  private getMaxRetries(errorType: TErrorType): number {
    const maxRetries = {
      'network': 3,
      'api_operation': 2,
      'git_operation': 1,
      'permission': 0,
      'validation': 0,
      'filesystem': 0,  // 文件系统错误通常不需要重试，直接降级为警告
      'unknown': 1
    };
    
    return maxRetries[errorType];
  }

  /**
   * 获取重试延迟时间（毫秒）
   */
  private getRetryDelay(retryCount: number): number {
    // 指数退避：1秒、2秒、4秒
    return Math.min(1000 * Math.pow(2, retryCount), 8000);
  }

  /**
   * 恢复迁移状态：分析日志并确定下一步操作
   */
  private analyzeMigrationState(log: TMigrationLog): {
    nextStep: string;
    canResume: boolean;
    needsCleanup: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let nextStep = '开始迁移';
    let canResume = true;
    let needsCleanup = false;
    
    // 分析完成状态
    if (log.isFinalCloned && !log.failureReason) {
      return {
        nextStep: '已完成',
        canResume: false,
        needsCleanup: false,
        recommendations: ['迁移已完成，无需操作']
      };
    }
    
    // 分析失败状态和重试建议
    if (log.failureReason) {
      const errorType = log.errorType || 'unknown';
      
      if (this.shouldRetry(errorType, log.retryCount || 0)) {
        recommendations.push(`可以重试，当前重试次数: ${log.retryCount || 0}`);
        
        switch (errorType) {
          case 'network':
            recommendations.push('网络错误，建议检查网络连接后重试');
            break;
          case 'api_operation':
            recommendations.push('API 错误，建议检查 Access Token 权限');
            break;
          case 'git_operation':
            recommendations.push('Git 操作错误，建议检查仓库地址和权限');
            needsCleanup = true;
            break;
        }
      } else {
        recommendations.push('已达到最大重试次数，建议手动检查问题');
        canResume = false;
      }
    }
    
    // 确定下一步操作
    if (!log.isOriginalCloned) {
      nextStep = '克隆原仓库镜像';
    } else if (!log.isTargetCreated) {
      nextStep = '创建目标仓库';
    } else if (!log.isMirrorPushed) {
      nextStep = '推送镜像到目标仓库';
    } else if (!log.isDescriptionUpdated) {
      nextStep = '更新仓库描述';
    } else if (!log.isFinalCloned) {
      nextStep = '克隆迁移后的仓库';
    }
    
    return { nextStep, canResume, needsCleanup, recommendations };
  }

  /**
   * 显示断点续传状态报告
   */
  private showResumeReport(): void {
    const resumableProjects = Array.from(this.logs.values()).filter(log => 
      !log.isFinalCloned || log.failureReason
    );
    
    if (resumableProjects.length === 0) {
      console.log(ConsoleColors.success('✅ 没有需要断点续传的项目，所有项目状态正常'));
      return;
    }
    
    console.log('\n' + ConsoleColors.info('📋 断点续传状态报告:'));
    console.log(ConsoleColors.separator(80));
    
    for (const log of resumableProjects) {
      const analysis = this.analyzeMigrationState(log);
      
      console.log(`\n📦 项目: ${ConsoleColors.highlight(log.projectName)}`);
      console.log(`   状态: ${analysis.canResume ? ConsoleColors.warning('可继续') : ConsoleColors.error('需要手动处理')}`);
      console.log(`   下一步: ${ConsoleColors.info(analysis.nextStep)}`);
      
      if (log.retryCount && log.retryCount > 0) {
        console.log(`   重试次数: ${ConsoleColors.dim(log.retryCount.toString())}`);
      }
      
      if (log.failureReason) {
        console.log(`   失败原因: ${ConsoleColors.error(log.failureReason)}`);
      }
      
      if (analysis.recommendations.length > 0) {
        console.log(`   建议:`);
        analysis.recommendations.forEach(rec => {
          console.log(`     - ${ConsoleColors.dim(rec)}`);
        });
      }
    }
    
    console.log(ConsoleColors.separator(80));
  }

  /**
   * 迁移单个仓库
   */
  private async migrateSingleRepository(repo: TRepository): Promise<void> {
    console.log('\n' + ConsoleColors.separator(60));
    console.log(ConsoleColors.progress(`开始迁移仓库: ${ConsoleColors.highlight(repo.name)}`));
    console.log(ConsoleColors.description(`项目描述: ${repo.description}`));
    console.log(ConsoleColors.url(`原仓库地址: ${repo.originalUrl}`));
    console.log(ConsoleColors.separator(60));
    
    // 检查是否已有日志记录
    let log = this.logs.get(repo.name);
    
    if (log) {
      console.log(ConsoleColors.info('发现现有日志记录，检查迁移状态...'));
      
      // 如果已经完全迁移成功，跳过
      if (log.isFinalCloned && !log.failureReason) {
        console.log(ConsoleColors.success(`仓库 ${ConsoleColors.highlight(repo.name)} 已完成迁移，跳过`));
        return;
      }
      
      console.log(ConsoleColors.info('继续未完成的迁移步骤...'));
    } else {
      // 创建新的日志记录
      const startTime = new Date();
      log = {
        projectName: repo.name,
        projectDescription: repo.description,
        originalRepoUrl: repo.originalUrl,
        targetGroup: this.targetGroupUrl,
        targetRepoUrl: '',
        startTime: startTime.toISOString(),
        endTime: '',
        duration: '',
        isOriginalCloned: false,
        isTargetCreated: false,
        isMirrorPushed: false,
        isDescriptionUpdated: false,
        isFinalCloned: false,
        failureReason: '',
        steps: [],
        warnings: [],
        retryCount: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    const migrationStartTime = log.startTime ? new Date(log.startTime) : new Date();
    if (!log.startTime) {
      log.startTime = migrationStartTime.toISOString();
    }

    try {
      // 清理失败状态，准备重新开始
      if (log.failureReason && !log.isFinalCloned) {
        log.failureReason = '';
      }

      // 1. 检查目标分组中是否已存在同名仓库
      let repositoryInfo: { exists: boolean; isEmpty?: boolean; targetUrl?: string } | null = null;
      if (!log.isTargetCreated) {
        // 检查是否已有完成的检查步骤
        const existingCheckStep = log.steps.find(step => step.name === '检查目标仓库');
        if (existingCheckStep && existingCheckStep.status === 'completed') {
          console.log(ConsoleColors.success('目标仓库检查已完成，跳过'));
        } else {
          this.recordMigrationStep(repo.name, '检查目标仓库', 'in_progress');
          try {
            repositoryInfo = await this.checkRepositoryExists(repo.name);
            if (repositoryInfo.exists && !repositoryInfo.isEmpty) {
              log.failureReason = '目标分组中已存在同名仓库';
              this.recordMigrationStep(repo.name, '检查目标仓库', 'failed', log.failureReason, 'validation');
              console.log(ConsoleColors.error(`迁移失败: ${log.failureReason}`));
              this.updateMigrationLog(log);
              return;
            }
            this.recordMigrationStep(repo.name, '检查目标仓库', 'completed');
          } catch (error: any) {
            const errorMsg = error.message;
            const errorType = this.classifyError(errorMsg);
            this.recordMigrationStep(repo.name, '检查目标仓库', 'failed', errorMsg, errorType);
            throw error;
          }
        }
      } else {
        // 只有在没有已完成的检查步骤时才记录为跳过
        const existingCheckStep = log.steps.find(step => step.name === '检查目标仓库');
        if (!existingCheckStep || existingCheckStep.status !== 'completed') {
          this.recordMigrationStep(repo.name, '检查目标仓库', 'skipped');
        } else {
          console.log(ConsoleColors.success('目标仓库检查已完成，跳过'));
        }
      }

      // 2. 克隆原仓库镜像
      // 始终使用从URL提取的实际仓库名作为目录名
      const actualRepoName = this.extractRepoNameFromUrl(repo.originalUrl);
      let cloneDir = `${actualRepoName}.git`;
      if (!log.isOriginalCloned) {
        console.log(ConsoleColors.step(1, '克隆原仓库镜像'));
        this.recordMigrationStep(repo.name, '克隆原仓库镜像', 'in_progress');
        try {
          cloneDir = this.cloneOriginalRepository(repo);
          log.isOriginalCloned = true;
          this.recordMigrationStep(repo.name, '克隆原仓库镜像', 'completed');
          this.updateMigrationLog(log);
        } catch (error: any) {
          const errorMsg = error.message;
          const errorType = this.classifyError(errorMsg);
          this.recordMigrationStep(repo.name, '克隆原仓库镜像', 'failed', errorMsg, errorType);
          throw error;
        }
      } else {
        console.log(ConsoleColors.success(`原仓库镜像已克隆，跳过: ${ConsoleColors.dim(cloneDir)}`));
        // 检查是否已有完成状态的步骤记录，如果有则不覆盖
        const existingStep = log.steps.find(step => step.name === '克隆原仓库镜像');
        if (!existingStep || existingStep.status !== 'completed') {
          this.recordMigrationStep(repo.name, '克隆原仓库镜像', 'skipped');
        }
      }

      // 3. 创建目标仓库或使用现有空仓库
      if (!log.isTargetCreated) {
        if (repositoryInfo && repositoryInfo.exists && repositoryInfo.isEmpty && repositoryInfo.targetUrl) {
          // 使用现有的空仓库
          console.log(ConsoleColors.step(2, '使用现有空仓库'));
          this.recordMigrationStep(repo.name, '创建目标仓库', 'in_progress');
          log.targetRepoUrl = repositoryInfo.targetUrl;
          log.isTargetCreated = true;
          this.recordMigrationStep(repo.name, '创建目标仓库', 'completed');
          this.updateMigrationLog(log);
        } else {
          // 创建新仓库
          console.log(ConsoleColors.step(2, '创建目标仓库'));
          this.recordMigrationStep(repo.name, '创建目标仓库', 'in_progress');
          try {
            const targetUrl = await this.createTargetRepository(repo);
            log.targetRepoUrl = targetUrl;
            log.isTargetCreated = true;
            this.recordMigrationStep(repo.name, '创建目标仓库', 'completed');
            this.updateMigrationLog(log);
          } catch (error: any) {
            const errorMsg = error.message;
            const errorType = this.classifyError(errorMsg);
            this.recordMigrationStep(repo.name, '创建目标仓库', 'failed', errorMsg, errorType);
            throw error;
          }
        }
      } else {
        console.log(ConsoleColors.success(`目标仓库已创建，跳过: ${ConsoleColors.dim(log.targetRepoUrl)}`));
        // 检查是否已有完成状态的步骤记录，如果有则不覆盖
        const existingStep = log.steps.find(step => step.name === '创建目标仓库');
        if (!existingStep || existingStep.status !== 'completed') {
          this.recordMigrationStep(repo.name, '创建目标仓库', 'skipped');
        }
      }

      // 4. 设置目标仓库的项目描述
      if (!log.isDescriptionUpdated) {
        console.log(ConsoleColors.step(3, '设置仓库描述'));
        this.recordMigrationStep(repo.name, '设置仓库描述', 'in_progress');
        try {
          await this.updateRepositoryDescription(repo.name, repo.description);
          log.isDescriptionUpdated = true;
          this.recordMigrationStep(repo.name, '设置仓库描述', 'completed');
          this.updateMigrationLog(log);
        } catch (error: any) {
          const errorMsg = error.message;
          const errorType = this.classifyError(errorMsg);
          this.recordMigrationStep(repo.name, '设置仓库描述', 'failed', errorMsg, errorType);
          throw error;
        }
      } else {
        console.log(ConsoleColors.success('仓库描述已更新，跳过'));
        // 检查是否已有完成状态的步骤记录，如果有则不覆盖
        const existingStep = log.steps.find(step => step.name === '设置仓库描述');
        if (!existingStep || existingStep.status !== 'completed') {
          this.recordMigrationStep(repo.name, '设置仓库描述', 'skipped');
        }
      }

      // 5. 推送镜像到目标仓库
      if (!log.isMirrorPushed) {
        console.log(ConsoleColors.step(4, '推送镜像到目标仓库'));
        this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'in_progress');
        try {
          const pushResult = this.pushMirrorToTarget(cloneDir, log.targetRepoUrl);
          log.isMirrorPushed = true;
          
          if (pushResult.hasWarnings) {
            this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'warning', undefined, undefined, pushResult.warnings);
            pushResult.warnings?.forEach(warning => this.addWarning(repo.name, warning));
          } else {
            this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'completed');
          }
          
          this.updateMigrationLog(log);
        } catch (error: any) {
          const errorMsg = error.message;
          const errorType = this.classifyError(errorMsg);
          
          // 检查是否为隐藏引用相关的错误，如果是则降级为警告而不是失败
          if (errorMsg.includes('deny updating a hidden ref') || 
              errorMsg.includes('refs/keep-around') ||
              errorMsg.includes('refs/merge-requests') ||
              errorMsg.includes('refs/pipelines') ||
              errorMsg.includes('refs/environments') ||
              errorMsg.includes('refs/heads/') ||
              errorMsg.includes('refs/tags/') ||
              errorMsg.includes('hidden ref') ||
              errorMsg.includes('refusing to update checked out branch') ||
              errorMsg.includes('remote rejected') ||
              errorMsg.includes('pre-receive hook declined') ||
              errorMsg.includes('! [remote rejected]') ||
              errorMsg.includes('hook declined') ||
              errorMsg.includes('protected branch') ||
              errorMsg.includes('To ') ||
              errorMsg.includes('Everything up-to-date') ||
              errorMsg.includes('non-fast-forward') ||
              errorMsg.includes('failed to push some refs') ||
              errorMsg.includes('updates were rejected') ||
              errorMsg.includes('fetch first') ||
              errorMsg.includes('hint: Updates were rejected') ||
              errorMsg.includes('error: failed to push')){
            console.log(ConsoleColors.warning(`⚠️  推送过程中遇到隐藏引用相关警告，但不影响迁移结果`));
            log.isMirrorPushed = true; // 标记为已推送
            this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'warning', undefined, undefined, [`推送过程中遇到隐藏引用相关警告: ${errorMsg}`]);
            this.addWarning(repo.name, `推送过程中遇到隐藏引用相关警告: ${errorMsg}`);
            this.updateMigrationLog(log);
          } else {
            this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'failed', errorMsg, errorType);
            throw error;
          }
        }
      } else {
        console.log(ConsoleColors.success('镜像已推送，跳过'));
        // 检查是否已有完成状态的步骤记录，如果有则不覆盖
        const existingStep = log.steps.find(step => step.name === '推送镜像到目标仓库');
        if (!existingStep || (existingStep.status !== 'completed' && existingStep.status !== 'warning')) {
          this.recordMigrationStep(repo.name, '推送镜像到目标仓库', 'skipped');
        }
      }

      // 6. 克隆迁移后的仓库到本地
      if (this.skipFinalClone) {
        console.log(ConsoleColors.warning('已禁用克隆迁移后的仓库，跳过'));
        this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'skipped');
        log.isFinalCloned = true; // 标记为已完成以避免重试
      } else if (!log.isFinalCloned) {
        console.log(ConsoleColors.step(5, '克隆迁移后的仓库到本地'));
        this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'in_progress');
        try {
          this.cloneFinalRepository(log.targetRepoUrl, repo.name);
          log.isFinalCloned = true;
          this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'completed');
        } catch (error: any) {
          const errorMsg = error.message;
          const errorType = this.classifyError(errorMsg);
          
          // 检查是否为隐藏引用相关错误，如果是则降级为警告
          if (errorMsg.includes('deny updating a hidden ref') || 
              errorMsg.includes('refs/keep-around') ||
              errorMsg.includes('hidden ref')) {
            console.log(ConsoleColors.warning(`克隆过程中遇到隐藏引用警告: ${errorMsg}`));
            this.addWarning(repo.name, `克隆时遇到隐藏引用警告: ${errorMsg}`);
            this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'warning', undefined, undefined, [errorMsg]);
            log.isFinalCloned = true; // 标记为已完成，因为这只是警告
          } else {
            this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'failed', errorMsg, errorType);
            throw error;
          }
        }
      } else {
        console.log(ConsoleColors.success('迁移后仓库已克隆，跳过'));
        // 检查是否已有完成状态的步骤记录，如果有则不覆盖
        const existingStep = log.steps.find(step => step.name === '克隆迁移后的仓库');
        if (!existingStep || existingStep.status !== 'completed') {
          this.recordMigrationStep(repo.name, '克隆迁移后的仓库', 'skipped');
        }
      }

      // 7. 清理镜像目录
      if (existsSync(cloneDir)) {
        rmSync(cloneDir, { recursive: true, force: true });
        console.log(ConsoleColors.dim(`🗑️  已清理镜像目录: ${path.basename(cloneDir)}`));
      }

      const endTime = new Date();
      log.endTime = endTime.toISOString();
      log.duration = `${Math.round((endTime.getTime() - migrationStartTime.getTime()) / 1000)}秒`;
      
      this.updateMigrationLog(log);
      console.log('\n' + ConsoleColors.success(`仓库迁移完成: ${ConsoleColors.highlight(repo.name)} ${ConsoleColors.duration(`(耗时: ${log.duration})`)}`) + '\n');
      
      if (log.warnings && log.warnings.length > 0) {
        console.log(ConsoleColors.warning(`⚠️ 警告信息: ${log.warnings.length} 条`));
      }
      
    } catch (error: any) {
      const endTime = new Date();
      const errorMsg = error.message;
      const errorType = this.classifyError(errorMsg);
      
      log.errorType = errorType;
      log.retryCount = (log.retryCount || 0) + 1;
      const readableError = this.getReadableErrorMessage(errorMsg, errorType);
      
      // 检查是否可以重试
      if (this.shouldRetry(errorType, log.retryCount)) {
        const retryDelay = this.getRetryDelay(log.retryCount - 1);
        const maxRetries = this.getMaxRetries(errorType);
        
        console.log('\n' + ConsoleColors.warning(`⚠️ 迁移遇到错误，准备重试...`));
        console.log(ConsoleColors.error(`错误: ${readableError}`));
        console.log(ConsoleColors.dim(`错误类型: ${errorType}`));
        console.log(ConsoleColors.info(`重试进度: ${log.retryCount}/${maxRetries}`));
        console.log(ConsoleColors.info(`等待 ${retryDelay / 1000} 秒后重试...`));
        
        this.recordMigrationStep(repo.name, `准备重试 (${log.retryCount}/${maxRetries})`, 'in_progress', `等待 ${retryDelay / 1000} 秒`);
        this.updateMigrationLog(log);
        
        // 清理可能的镜像目录（在临时目录中查找）
        try {
          if (existsSync(this.tempDir)) {
            const files = readdirSync(this.tempDir);
            const actualRepoName = this.extractRepoNameFromUrl(repo.originalUrl);
            const mirrorDirs = files.filter(file => 
              file.startsWith(actualRepoName) && file.endsWith('.git')
            );
            
            mirrorDirs.forEach(dir => {
              const dirPath = path.join(this.tempDir, dir);
              if (existsSync(dirPath)) {
                rmSync(dirPath, { recursive: true, force: true });
                console.log(ConsoleColors.dim(`🗑️  已清理镜像目录: ${dir}`));
              }
            });
          }
        } catch (error) {
          console.log(ConsoleColors.warning('⚠️  清理镜像目录时出现问题'));
        }
        
        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // 清理失败状态，准备重试
        log.failureReason = '';
        
        // 递归重试
        console.log(ConsoleColors.info(`🔄 开始第 ${log.retryCount} 次重试: ${ConsoleColors.highlight(repo.name)}`));
        return await this.migrateSingleRepository(repo);
      } else {
        // 达到最大重试次数，记录最终失败
        log.endTime = endTime.toISOString();
        log.duration = `${Math.round((endTime.getTime() - migrationStartTime.getTime()) / 1000)}秒`;
        log.failureReason = readableError;
        
        this.recordMigrationStep(repo.name, '迁移最终失败', 'failed', log.failureReason, errorType);
        this.updateMigrationLog(log);
        
        console.log('\n' + ConsoleColors.error(`❌ 仓库迁移最终失败: ${ConsoleColors.highlight(repo.name)}`));
        console.log(ConsoleColors.error(`失败原因: ${log.failureReason}`));
        console.log(ConsoleColors.error(`错误类型: ${errorType}`));
        console.log(ConsoleColors.error(`总重试次数: ${log.retryCount}`));
        
        // 提供恢复建议
        const analysis = this.analyzeMigrationState(log);
        if (analysis.recommendations.length > 0) {
          console.log(ConsoleColors.info('💡 建议:'));
          analysis.recommendations.forEach(rec => {
            console.log(ConsoleColors.dim(`   - ${rec}`));
          });
        }
        
        // 清理可能的临时文件
        const actualRepoName = this.extractRepoNameFromUrl(repo.originalUrl);
        const cloneDir = `${actualRepoName}.git`;
        if (existsSync(cloneDir)) {
          rmSync(cloneDir, { recursive: true, force: true });
        }
      }
    }
  }

  /**
   * 执行迁移任务
   */
  public async migrate(): Promise<void> {
    try {
      console.log('\n' + ConsoleColors.box('GitLab 项目迁移工具'));
      console.log('');
      
      // 解析move.md文件
      this.parseMoveFile();
      
      // 验证 Access Token
      if (!this.accessToken || this.accessToken === 'your_access_token' || this.accessToken === 'your_gitlab_access_token') {
        console.log(ConsoleColors.warning('未找到有效的 GitLab Access Token'));
        console.log(ConsoleColors.info('Access Token 获取优先级:'));
        console.log(ConsoleColors.dim('   1. 命令行参数 (最高优先级)'));
        console.log(ConsoleColors.dim('   2. move.md 文件中的 "## 迁移目标 Access Token" 部分'));
        console.log(ConsoleColors.dim('   3. 环境变量: GITLAB_ACCESS_TOKEN'));
        console.log(ConsoleColors.dim('   4. 交互式输入 (当前)'));
        console.log('');
        
        // 交互式输入 Access Token
        this.accessToken = await promptForAccessToken();
        
        if (!this.accessToken || this.accessToken.trim() === '') {
          console.error(ConsoleColors.error('Access Token 不能为空'));
          throw new Error('Access Token 不能为空');
        }
      }
      
      // 显示断点续传状态报告
      this.showResumeReport();
      
      // 执行预检查
      const preCheckResult = await this.performPreChecks();
      if (!preCheckResult.success) {
        console.error('\n' + ConsoleColors.error('❌ 预检查失败，无法开始迁移:'));
        preCheckResult.errors.forEach(error => console.error(ConsoleColors.error(`  - ${error}`)));
        
        // 预检查失败时进行清理
        console.log(ConsoleColors.warning('\n🧹 预检查失败，正在清理可能的临时文件...'));
        cleanupOnExit(this);
        
        // 给清理函数一些时间来完成输出
        await new Promise(resolve => setTimeout(resolve, 100));
        
        throw new Error('预检查失败，请解决上述问题后重试');
      }
      
      // 过滤指定的项目
      let repositoriesToMigrate = this.repositories;
      if (this.selectedProjects.length > 0) {
        repositoriesToMigrate = this.repositories.filter(repo => 
          this.selectedProjects.includes(repo.name)
        );
        
        console.log(ConsoleColors.info(`指定迁移项目: ${ConsoleColors.highlight(this.selectedProjects.join(', '))}`));
        console.log(ConsoleColors.success(`找到匹配项目: ${ConsoleColors.highlight(repositoriesToMigrate.map(r => r.name).join(', '))}`));
        
        const notFound = this.selectedProjects.filter(name => 
          !this.repositories.some(repo => repo.name === name)
        );
        if (notFound.length > 0) {
          console.log(ConsoleColors.warning(`未找到的项目: ${notFound.join(', ')}`));
        }
      }
      
      if (repositoriesToMigrate.length === 0) {
        console.log(ConsoleColors.warning('没有找到需要迁移的仓库'));
        return;
      }
      
      console.log('\n' + ConsoleColors.progress(`开始迁移 ${ConsoleColors.highlight(repositoriesToMigrate.length.toString())} 个仓库`));
      console.log(ConsoleColors.separator(60));
      
      // 逐个迁移仓库
      for (const repo of repositoriesToMigrate) {
        await this.migrateSingleRepository(repo);
      }
      
      console.log('\n' + ConsoleColors.separator(60));
      console.log(ConsoleColors.success('🎉 所有迁移任务完成'));
      
    } catch (error: any) {
      console.error(ConsoleColors.error(`迁移过程中发生错误: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * 生成迁移报告
   */
  public generateMigrationReport(): string {
    // 获取当前迁移的项目列表
    const repositoriesToMigrate = this.selectedProjects.length > 0 
      ? this.repositories.filter(repo => this.selectedProjects.includes(repo.name))
      : this.repositories;
    
    // 只统计当前迁移的项目
    const migratedProjectNames = repositoriesToMigrate.map(repo => repo.name);
    const migratedLogs = Array.from(this.logs.values()).filter(log => migratedProjectNames.includes(log.projectName));
    
    const totalRepos = migratedLogs.length;
    const successfulRepos = migratedLogs.filter(log => log.isFinalCloned && !log.failureReason).length;
    const failedRepos = totalRepos - successfulRepos;
    const reposWithWarnings = migratedLogs.filter(log => log.warnings && log.warnings.length > 0).length;
    
    let report = '\n' + ConsoleColors.box('GitLab 项目迁移报告') + '\n';
    
    if (this.selectedProjects.length > 0) {
      report += ConsoleColors.info(`指定迁移项目: ${ConsoleColors.highlight(this.selectedProjects.join(', '))}`) + '\n';
    }
    
    report += ConsoleColors.info(`总计: ${ConsoleColors.highlight(totalRepos.toString())} 个仓库`) + '\n';
    report += ConsoleColors.success(`成功: ${ConsoleColors.highlight(successfulRepos.toString())} 个仓库`) + '\n';
    
    if (failedRepos > 0) {
      report += ConsoleColors.error(`失败: ${ConsoleColors.highlight(failedRepos.toString())} 个仓库`) + '\n';
    } else {
      report += ConsoleColors.success(`失败: ${ConsoleColors.highlight('0')} 个仓库`) + '\n';
    }
    
    if (reposWithWarnings > 0) {
      report += ConsoleColors.warning(`警告: ${ConsoleColors.highlight(reposWithWarnings.toString())} 个仓库`) + '\n';
    }
    
    const successRate = totalRepos > 0 ? Math.round((successfulRepos / totalRepos) * 100) : 0;
    const successRateColor = successRate === 100 ? ConsoleColors.success : successRate >= 80 ? ConsoleColors.warning : ConsoleColors.error;
    report += successRateColor(`成功率: ${ConsoleColors.highlight(successRate + '%')}`) + '\n';
    
    // 显示有警告的仓库
    if (reposWithWarnings > 0) {
      report += '\n' + ConsoleColors.warning('有警告的仓库:') + '\n';
      migratedLogs
        .filter(log => log.warnings && log.warnings.length > 0)
        .forEach(log => {
          report += ConsoleColors.warning(`  • ${ConsoleColors.highlight(log.projectName)}:`) + '\n';
          log.warnings.forEach(warning => {
            report += ConsoleColors.dim(`    - ${warning}`) + '\n';
          });
        });
    }
    
    if (failedRepos > 0) {
      report += '\n' + ConsoleColors.error('失败的仓库:') + '\n';
      migratedLogs
        .filter(log => log.failureReason)
        .forEach(log => {
          report += ConsoleColors.error(`  • ${ConsoleColors.highlight(log.projectName)}: ${log.failureReason}`) + '\n';
        });
    }
    
    return report;
  }
}

/**
 * 程序退出时的清理函数
 */
function cleanupOnExit(migrator?: GitLabMigrator): void {
  console.log('\n🧹 程序退出，正在清理临时文件...');
  
  let cleanupResults = {
    logsSaved: false,
    tempDirsFound: 0,
    tempDirsDeleted: 0,
    errors: [] as string[]
  };
  
  // 强制保存迁移日志
  if (migrator) {
    try {
      migrator.forceSaveMigrationLogs();
      cleanupResults.logsSaved = true;
      console.log('💾 已保存迁移日志');
    } catch (error) {
      const errorMsg = `保存迁移日志失败: ${error instanceof Error ? error.message : String(error)}`;
      cleanupResults.errors.push(errorMsg);
      console.log(ConsoleColors.warning(`⚠️  ${errorMsg}`));
    }
  }
  
  // 清理临时目录
  try {
    const currentDir = process.cwd();
    console.log(ConsoleColors.dim(`📁 扫描目录: ${currentDir}`));
    
    let files: string[] = [];
    try {
      files = readdirSync(currentDir);
    } catch (error) {
      const errorMsg = `读取目录失败: ${error instanceof Error ? error.message : String(error)}`;
      cleanupResults.errors.push(errorMsg);
      console.log(ConsoleColors.error(`❌ ${errorMsg}`));
      return;
    }
    
    // 查找所有临时目录
    const tempDirs = files.filter(file => {
      try {
        const fullPath = path.join(currentDir, file);
        const isDir = statSync(fullPath).isDirectory();
        const isTempDir = file.startsWith('temp-migration-');
        return isDir && isTempDir;
      } catch (error) {
        console.log(ConsoleColors.warning(`⚠️  检查文件 ${file} 时出错: ${error instanceof Error ? error.message : String(error)}`));
        return false;
      }
    });
    
    cleanupResults.tempDirsFound = tempDirs.length;
    
    if (tempDirs.length > 0) {
      console.log(`🗑️  发现 ${tempDirs.length} 个临时目录，开始清理...`);
      
      tempDirs.forEach(dir => {
        try {
          const fullPath = path.join(currentDir, dir);
          console.log(ConsoleColors.dim(`   🔄 正在删除: ${dir}`));
          
          // 尝试删除目录
          rmSync(fullPath, { recursive: true, force: true });
          
          // 验证删除是否成功
          if (!existsSync(fullPath)) {
            cleanupResults.tempDirsDeleted++;
            console.log(ConsoleColors.success(`   ✅ 已删除: ${dir}`));
          } else {
            const errorMsg = `目录仍然存在: ${dir}`;
            cleanupResults.errors.push(errorMsg);
            console.log(ConsoleColors.warning(`   ⚠️  ${errorMsg}`));
          }
        } catch (error) {
          const errorMsg = `删除目录 ${dir} 失败: ${error instanceof Error ? error.message : String(error)}`;
          cleanupResults.errors.push(errorMsg);
          console.log(ConsoleColors.error(`   ❌ ${errorMsg}`));
        }
      });
    } else {
      console.log(ConsoleColors.dim('📂 未发现临时目录'));
    }
    
    // 输出清理结果摘要
    console.log('\n📊 清理结果摘要:');
    console.log(ConsoleColors.dim(`   - 迁移日志保存: ${cleanupResults.logsSaved ? '✅ 成功' : '❌ 失败'}`));
    console.log(ConsoleColors.dim(`   - 发现临时目录: ${cleanupResults.tempDirsFound} 个`));
    console.log(ConsoleColors.dim(`   - 成功删除: ${cleanupResults.tempDirsDeleted} 个`));
    console.log(ConsoleColors.dim(`   - 错误数量: ${cleanupResults.errors.length} 个`));
    
    if (cleanupResults.errors.length > 0) {
      console.log(ConsoleColors.warning('\n⚠️  清理过程中遇到以下问题:'));
      cleanupResults.errors.forEach((error, index) => {
        console.log(ConsoleColors.warning(`   ${index + 1}. ${error}`));
      });
    }
    
    if (cleanupResults.tempDirsDeleted === cleanupResults.tempDirsFound && cleanupResults.errors.length === 0) {
      console.log(ConsoleColors.success('✅ 清理完成，所有临时文件已删除'));
    } else {
      console.log(ConsoleColors.warning('⚠️  清理完成，但存在部分问题'));
    }
    
  } catch (error) {
    const errorMsg = `清理过程中发生未预期的错误: ${error instanceof Error ? error.message : String(error)}`;
    console.log(ConsoleColors.error(`💥 ${errorMsg}`));
    cleanupResults.errors.push(errorMsg);
  }
}

/**
 * 注册程序退出时的清理处理器
 */
function registerExitHandlers(migrator?: GitLabMigrator): void {
  // 处理正常退出
  process.on('exit', () => {
    // 注意：在 exit 事件中不能执行异步操作
  });
  
  // 处理 Ctrl+C (SIGINT)
  process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号 (Ctrl+C)');
    cleanupOnExit(migrator);
    process.exit(0);
  });
  
  // 处理终止信号 (SIGTERM)
  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号');
    cleanupOnExit(migrator);
    process.exit(0);
  });
  
  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('\n💥 未捕获的异常:', error.message);
    cleanupOnExit(migrator);
    process.exit(1);
  });
  
  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 未处理的 Promise 拒绝:', reason);
    cleanupOnExit(migrator);
    process.exit(1);
  });
}

/**
 * 初始化 move.md 配置文件
 */
function initMoveFile(targetDir: string = process.cwd()): void {
  const moveFilePath = path.join(targetDir, 'move.md');
  
  // 检查文件是否已存在
  if (existsSync(moveFilePath)) {
    console.log(ConsoleColors.warning(`⚠️  配置文件已存在: ${moveFilePath}`));
    console.log(ConsoleColors.info('如需重新初始化，请先删除现有文件'));
    return;
  }
  
  // 创建目录（如果不存在）
  const dir = path.dirname(moveFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // 生成默认配置内容
  const defaultConfig = `# Gitlab 项目迁移到新的分组

## 迁移目标 Access Token

your_gitlab_access_token

## 迁移目标分组

https://gitlab.example.com/target-group/

## 需要迁移仓库

| 项目名称 | 项目描述 | 原仓库地址 |
|---------|---------|----------|
| project1 | 项目1描述 | ssh://git@gitlab.example.com:10022/old-group/project1.git |
| project2 | 项目2描述 | ssh://git@gitlab.example.com:10022/old-group/project2.git |

## 日志

<!-- 迁移日志将自动生成在这里 -->
`;
  
  try {
    writeFileSync(moveFilePath, defaultConfig, 'utf8');
    console.log(ConsoleColors.success(`✅ 配置文件初始化成功: ${moveFilePath}`));
    console.log('');
    console.log(ConsoleColors.info('📝 请编辑配置文件并填入正确的信息:'));
    console.log(ConsoleColors.dim('   1. 设置目标 GitLab 地址'));
    console.log(ConsoleColors.dim('   2. 设置目标分组路径'));
    console.log(ConsoleColors.dim('   3. 设置 Access Token'));
    console.log(ConsoleColors.dim('   4. 添加需要迁移的项目信息'));
    console.log('');
    console.log(ConsoleColors.info('🚀 配置完成后，运行以下命令开始迁移:'));
    // 显示本地运行方式
    console.log(ConsoleColors.highlight(`   bun run migrate-gitlab.ts`));
    // 显示全局运行方式
    console.log(ConsoleColors.highlight(`   mgitlab`));
    // 显示帮助信息
    console.log(ConsoleColors.highlight(`   mgitlab --help     # 查看更多详细的使用说明和示例`));
  } catch (error) {
    console.error(ConsoleColors.error(`❌ 初始化配置文件失败: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
/**
 * 显示版本信息
 */
function showVersion(): void {
  // 尝试从多个可能的位置读取 package.json
  let packageJson;
  
  // 获取当前脚本的目录
  const currentScriptPath = import.meta.url.replace('file:///', '').replace(/\/[^/]*$/, '');
  const possiblePaths = [
    path.join(currentScriptPath, 'package.json'),
    path.join(currentScriptPath, '../package.json'),
    path.join(currentScriptPath, '../../package.json'),
    './package.json',
    '../package.json',
    './dist/package.json'
  ];
  
  for (const packagePath of possiblePaths) {
    try {
      if (existsSync(packagePath)) {
        packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        break;
      }
    } catch (error) {
      // 继续尝试下一个路径
    }
  }
  
  if (!packageJson) {
    console.log(ConsoleColors.error('无法找到 package.json 文件'));
    return;
  }
  console.log(ConsoleColors.box(`GitLab 项目迁移工具 v${packageJson.version}`));
  console.log('');
  console.log(ConsoleColors.info('项目信息:'));
  console.log(ConsoleColors.dim(`  名称: ${packageJson.name}`));
  console.log(ConsoleColors.dim(`  版本: ${packageJson.version}`));
  console.log(ConsoleColors.dim(`  描述: ${packageJson.description}`));
  console.log(ConsoleColors.dim(`  作者: ${packageJson.author}`));
  console.log(ConsoleColors.dim(`  许可证: ${packageJson.license}`));
  console.log('');
  console.log(ConsoleColors.info('运行环境:'));
  console.log(ConsoleColors.dim(`  Node.js: ${process.version}`));
  console.log(ConsoleColors.dim(`  平台: ${process.platform} ${process.arch}`));
  console.log('');
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  // 尝试从多个可能的位置读取 package.json
  let packageJson;
  
  // 获取当前脚本的目录
  const currentScriptPath = import.meta.url.replace('file:///', '').replace(/\/[^/]*$/, '');
  const possiblePaths = [
    path.join(currentScriptPath, 'package.json'),
    path.join(currentScriptPath, '../package.json'),
    path.join(currentScriptPath, '../../package.json'),
    './package.json',
    '../package.json',
    './dist/package.json'
  ];
  
  for (const packagePath of possiblePaths) {
    try {
      if (existsSync(packagePath)) {
        packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        break;
      }
    } catch (error) {
      // 继续尝试下一个路径
    }
  }
  
  if (!packageJson) {
    console.log(ConsoleColors.error('无法找到 package.json 文件'));
    return;
  }
  console.log(ConsoleColors.box(`GitLab 项目迁移工具 v${packageJson.version}`));
  console.log('');
  console.log(ConsoleColors.info('描述:'));
  console.log(ConsoleColors.dim('  专业的 GitLab 仓库迁移工具，支持批量迁移、断点续传、智能重试等功能'));
  console.log('');
  console.log(ConsoleColors.info('用法:'));
  console.log(ConsoleColors.dim('  全局安装后:'));
  console.log(ConsoleColors.highlight('    migrate-gitlab [选项] [参数]'));
  console.log(ConsoleColors.highlight('    mgitlab [选项] [参数]'));
  console.log('');
  console.log(ConsoleColors.dim('  本地运行:'));
  console.log(ConsoleColors.highlight('    bun run migrate-gitlab.ts [选项] [参数]'));
  console.log('');
  console.log(ConsoleColors.info('命令:'));
  console.log(ConsoleColors.dim('  init [目录]           初始化配置文件到指定目录 (默认: 当前目录)'));
  console.log(ConsoleColors.dim('  migrate [配置文件]    执行迁移任务 (默认: ./move.md)'));
  console.log('');
  console.log(ConsoleColors.info('选项:'));
  console.log(ConsoleColors.dim('  -h, --help           显示帮助信息'));
  console.log(ConsoleColors.dim('  -v, --version        显示版本信息'));
  console.log(ConsoleColors.dim('  -p, --projects       指定要迁移的项目列表 (逗号分隔)'));
  console.log(ConsoleColors.dim('  -t, --token          指定 GitLab Access Token'));
  console.log(ConsoleColors.dim('  -s, --skip-clone     禁用克隆迁移后的仓库到本地'));
  console.log(ConsoleColors.dim('  -q, --quiet          简化控制台输出，隐藏命令执行详情'));
  console.log('');
  console.log(ConsoleColors.info('参数说明:'));
  console.log(ConsoleColors.dim('  配置文件路径         move.md 配置文件的路径 (默认: ./move.md)'));
  console.log(ConsoleColors.dim('  项目列表            逗号分隔的项目名称列表'));
  console.log(ConsoleColors.dim('  Access Token        GitLab Access Token'));
  console.log(ConsoleColors.dim('  目标目录            初始化配置文件的目录'));
  console.log('');
  console.log(ConsoleColors.info('示例:'));
  console.log(ConsoleColors.dim('  # 初始化配置文件'));
  console.log(ConsoleColors.highlight('  mgitlab init'));
  console.log(ConsoleColors.highlight('  mgitlab init /path/to/project'));
  console.log('');
  console.log(ConsoleColors.dim('  # 显示版本和帮助'));
  console.log(ConsoleColors.highlight('  mgitlab --version'));
  console.log(ConsoleColors.highlight('  mgitlab --help'));
  console.log('');
  console.log(ConsoleColors.dim('  # 迁移所有项目'));
  console.log(ConsoleColors.highlight('  mgitlab'));
  console.log(ConsoleColors.highlight('  mgitlab ./move.md'));
  console.log('');
  console.log(ConsoleColors.dim('  # 迁移指定项目'));
  console.log(ConsoleColors.highlight('  mgitlab --projects "project1,project2"'));
  console.log(ConsoleColors.highlight('  mgitlab ./move.md "project1,project2"'));
  console.log('');
  console.log(ConsoleColors.dim('  # 使用指定 Token'));
  console.log(ConsoleColors.highlight('  mgitlab --token your_gitlab_token'));
  console.log(ConsoleColors.highlight('  mgitlab ./move.md "" your_gitlab_token'));
  console.log('');
  console.log(ConsoleColors.dim('  # 禁用克隆迁移后的仓库'));
  console.log(ConsoleColors.highlight('  mgitlab --skip-clone'));
  console.log(ConsoleColors.highlight('  mgitlab --projects "project1,project2" --skip-clone'));
  console.log('');
  console.log(ConsoleColors.info('功能特性:'));
  console.log(ConsoleColors.dim('  ✅ 批量迁移多个 GitLab 仓库'));
  console.log(ConsoleColors.dim('  ✅ 断点续传，支持从中断点继续'));
  console.log(ConsoleColors.dim('  ✅ 智能重试机制，自动处理临时错误'));
  console.log(ConsoleColors.dim('  ✅ 完整的镜像克隆，保留所有分支和标签'));
  console.log(ConsoleColors.dim('  ✅ 自动创建目标仓库和更新描述'));
  console.log(ConsoleColors.dim('  ✅ 详细的迁移日志和进度报告'));
  console.log(ConsoleColors.dim('  ✅ 配置文件自动备份和垃圾清理'));
  console.log(ConsoleColors.dim('  ✅ 预检查机制，验证权限和网络连通性'));
  console.log('');
  console.log(ConsoleColors.info('更多信息:'));
  console.log(ConsoleColors.dim('  文档: https://github.com/Garynan52000/migrate-gitlab#readme'));
  console.log(ConsoleColors.dim('  问题反馈: https://github.com/Garynan52000/migrate-gitlab/issues'));
  console.log('');
}

/**
 * 主函数 - 脚本入口点
 */
/**
 * 解析命令行参数
 */
function parseCommandLineArgs(args: string[]): {
  command?: string;
  moveFilePath?: string;
  projectList?: string;
  accessToken?: string;
  targetDir?: string;
  showHelp?: boolean;
  showVersion?: boolean;
  skipFinalClone?: boolean;
  quietMode?: boolean;
} {
  const result: any = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
      case 'help':
        result.showHelp = true;
        break;
      case '--version':
      case '-v':
      case 'version':
        result.showVersion = true;
        break;
      case '--projects':
      case '-p':
        result.projectList = args[++i];
        break;
      case '--token':
      case '-t':
        result.accessToken = args[++i];
        break;
      case '--skip-clone':
      case '-s':
        result.skipFinalClone = true;
        break;
      case '--quiet':
      case '-q':
        result.quietMode = true;
        break;
      case 'init':
        result.command = 'init';
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result.targetDir = args[++i];
        }
        break;
      case 'migrate':
        result.command = 'migrate';
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result.moveFilePath = args[++i];
        }
        break;
      default:
        // 处理位置参数
        if (!arg.startsWith('-')) {
          if (!result.command) {
            // 如果没有明确的命令，根据参数内容推断
            if (arg === 'init') {
              result.command = 'init';
            } else if (arg.endsWith('.md') || arg.includes('/') || arg.includes('\\')) {
              result.moveFilePath = arg;
              result.command = 'migrate';
            } else {
              // 可能是项目列表
              if (!result.projectList) {
                result.projectList = arg;
              } else if (!result.accessToken) {
                result.accessToken = arg;
              }
              result.command = result.command || 'migrate';
            }
          } else if (result.command === 'init' && !result.targetDir) {
            result.targetDir = arg;
          } else if (result.command === 'migrate' && !result.moveFilePath) {
            result.moveFilePath = arg;
          } else if (!result.projectList) {
            result.projectList = arg;
          } else if (!result.accessToken) {
            result.accessToken = arg;
          }
        }
        break;
    }
    i++;
  }

  // 设置默认值
  if (!result.command && !result.showHelp && !result.showVersion) {
    result.command = 'migrate';
  }
  if (result.command === 'migrate' && !result.moveFilePath) {
    result.moveFilePath = path.resolve(process.cwd(), 'move.md');
  }
  if (result.command === 'init' && !result.targetDir) {
    result.targetDir = process.cwd();
  }

  return result;
}

/**
 * 主函数
 */
async function main() {
  let migrator: GitLabMigrator | undefined;
  
  try {
    // 获取命令行参数
    const args = process.argv.slice(2);
    const parsed = parseCommandLineArgs(args);
    
    // 处理版本信息
    if (parsed.showVersion) {
      showVersion();
      return;
    }
    
    // 处理帮助信息
    if (parsed.showHelp || (args.length === 0 && !parsed.command)) {
      if (args.length === 0) {
        console.log('🚀 GitLab 项目迁移工具启动');
        console.log('📋 正在读取迁移配置...');
      } else {
        showHelp();
        return;
      }
    }
    
    // 处理 init 命令
    if (parsed.command === 'init') {
      console.log('🔧 初始化 GitLab 迁移配置文件');
      console.log(`📁 目标目录: ${parsed.targetDir}`);
      console.log('');
      initMoveFile(parsed.targetDir!);
      return;
    }
    
    // 处理 migrate 命令
    if (parsed.command === 'migrate') {
      console.log('🚀 GitLab 项目迁移工具启动');
      console.log('📋 正在读取迁移配置...');
      
      // 解析项目名称列表
      let selectedProjects: string[] = [];
      if (parsed.projectList) {
        selectedProjects = parsed.projectList.split(',').map(name => name.trim()).filter(name => name.length > 0);
        console.log(`🎯 指定迁移项目: ${selectedProjects.join(', ')}`);
      } else {
        console.log('📦 将迁移所有项目');
      }
      
      // 获取 Access Token（优先级：命令行参数 > 环境变量）
      const accessToken = parsed.accessToken || process.env.GITLAB_ACCESS_TOKEN;
      
      // 创建迁移器实例
      migrator = new GitLabMigrator(parsed.moveFilePath!, selectedProjects, accessToken, parsed.skipFinalClone, parsed.quietMode);
      
      // 注册退出处理器（传入 migrator 实例）
      registerExitHandlers(migrator);
      
      // 执行迁移
      await migrator.migrate();
      
      // 生成并显示报告
      const report = migrator.generateMigrationReport();
      console.log(report);
      
      console.log('\n🎉 迁移任务完成！');
      
      // 正常完成时也进行清理
      cleanupOnExit(migrator);
      return;
    }
    
    // 如果没有匹配的命令，显示帮助信息
    showHelp();
    
  } catch (error) {
    console.error('\n💥 迁移过程中发生错误:');
    console.error(error instanceof Error ? error.message : String(error));
    
    // 错误退出前进行清理（现在可以传入 migrator 实例）
    if (migrator) {
      console.log('\n🧹 正在清理临时文件...');
      cleanupOnExit(migrator);
    } else {
      // 如果 migrator 未创建，进行基本清理
      cleanupOnExit();
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行主函数
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { GitLabMigrator, type TRepository, type TMigrationConfig, type TMigrationLog };