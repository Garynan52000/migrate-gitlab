#!/usr/bin/env bun
/**
 * GitLab 仓库迁移工具
 * @description 专门用于 GitLab 仓库之间的迁移，支持镜像克隆、仓库创建、描述更新等功能
 */
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
 * GitLab 项目迁移器
 */
declare class GitLabMigrator {
    private moveFilePath;
    private accessToken;
    private targetGroupUrl;
    private repositories;
    private logs;
    private selectedProjects;
    private tempDir;
    private saveTimeout;
    private skipFinalClone;
    private quietMode;
    constructor(moveFilePath?: string, selectedProjects?: string[], accessToken?: string, skipFinalClone?: boolean, quietMode?: boolean);
    /**
     * 解析move.md文件
     */
    private parseMoveFile;
    /**
     * 验证URL格式
     */
    private isValidUrl;
    /**
     * 验证Git仓库URL格式
     */
    private isValidGitUrl;
    /**
     * 验证配置文件完整性
     */
    private validateConfiguration;
    /**
     * 解析现有的迁移日志
     */
    private parseExistingLogs;
    /**
     * 清理不在配置文件中的项目日志
     */
    private cleanupOrphanedLogs;
    /**
     * 获取GitLab API基础URL
     */
    private getGitLabApiBase;
    /**
     * 从GitLab URL中提取分组路径
     */
    private extractGroupPath;
    /**
     * 获取分组ID
     */
    private getGroupId;
    /**
     * 执行命令并返回结果
     */
    private executeCommand;
    /**
     * 执行命令并显示实时输出（用于需要显示进度的长时间运行命令）
     */
    private executeCommandWithProgress;
    /**
     * 执行命令并返回结果（支持错误降级处理）
     */
    private executeCommandWithWarningSupport;
    /**
     * 执行命令并显示实时输出（支持错误降级处理和进度显示）
     */
    private executeCommandWithWarningAndProgress;
    /**
     * 检查目标分组中是否已存在同名仓库
     */
    private checkRepositoryExists;
    /**
     * 检查仓库是否为空
     */
    private checkIfRepositoryIsEmpty;
    /**
     * 提示用户确认操作
     */
    private promptUserConfirmation;
    /**
     * 从仓库URL中提取仓库名
     */
    private extractRepoNameFromUrl;
    /**
     * 克隆原仓库镜像
     */
    private cloneOriginalRepository;
    /**
     * 创建目标仓库
     */
    private createTargetRepository;
    /**
     * 推送镜像到目标仓库
     */
    private pushMirrorToTarget;
    /**
     * 设置目标仓库的项目描述
     */
    private updateRepositoryDescription;
    /**
     * 克隆迁移后的仓库到本地
     */
    private cloneFinalRepository;
    /**
     * 延迟保存迁移日志，避免频繁创建备份
     */
    private scheduleSaveMigrationLogs;
    /**
     * 强制保存迁移日志（程序退出时调用）
     */
    forceSaveMigrationLogs(): void;
    /**
     * 更新迁移日志
     */
    private updateMigrationLog;
    /**
     * 创建配置文件备份
     */
    private createConfigBackup;
    /**
     * 清理旧备份文件（保留最近5个）
     */
    private cleanupOldBackups;
    /**
     * 清理旧的临时目录（保留最近3个，删除超过24小时的）
     */
    /**
     * 清理旧的临时目录
     * 增强版本：更好的错误处理、详细日志、空目录检测、强制清理策略
     */
    private cleanupOldTempDirectories;
    /**
     * 获取目录大小（字节）
     */
    private getDirectorySize;
    /**
     * 格式化字节大小为可读格式
     */
    private formatBytes;
    /**
     * 保存迁移日志到move.md文件
     */
    private saveMigrationLogs;
    /**
     * 记录迁移步骤
     */
    private recordMigrationStep;
    /**
     * 添加警告信息
     */
    private addWarning;
    /**
     * 分类错误类型
     */
    private classifyError;
    /**
     * 获取可读的错误信息
     */
    private getReadableErrorMessage;
    /**
     * 预检查机制：验证迁移前的各项条件
     */
    private performPreChecks;
    /**
     * 检查网络连通性
     */
    private checkNetworkConnectivity;
    /**
     * 检查 GitLab API 权限
     */
    private checkGitLabApiPermissions;
    /**
     * 检查目标分组权限
     */
    private checkTargetGroupPermissions;
    /**
     * 检查本地 Git 环境
     */
    private checkLocalGitEnvironment;
    /**
     * 智能重试机制：根据错误类型决定是否重试
     */
    private shouldRetry;
    /**
     * 获取不同错误类型的最大重试次数
     */
    private getMaxRetries;
    /**
     * 获取重试延迟时间（毫秒）
     */
    private getRetryDelay;
    /**
     * 恢复迁移状态：分析日志并确定下一步操作
     */
    private analyzeMigrationState;
    /**
     * 显示断点续传状态报告
     */
    private showResumeReport;
    /**
     * 迁移单个仓库
     */
    private migrateSingleRepository;
    /**
     * 执行迁移任务
     */
    migrate(): Promise<void>;
    /**
     * 生成迁移报告
     */
    generateMigrationReport(): string;
}
export { GitLabMigrator, type TRepository, type TMigrationConfig, type TMigrationLog };
//# sourceMappingURL=migrate-gitlab.d.ts.map