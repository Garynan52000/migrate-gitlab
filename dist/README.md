# GitLab 仓库迁移工具

🚀 专业的 GitLab 仓库迁移工具，支持批量迁移、断点续传、智能重试等功能

## 📋 目录

- [功能特性](#功能特性)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [安装方式](#安装方式)
- [使用方法](#使用方法)
- [配置文件](#配置文件)
- [命令行参数](#命令行参数)
- [使用示例](#使用示例)
- [高级功能](#高级功能)
- [故障排除](#故障排除)
- [注意事项](#注意事项)
- [API 文档](#api-文档)

## ✨ 功能特性

- ✅ **批量迁移** - 支持一次性迁移多个 GitLab 仓库
- ✅ **断点续传** - 支持从中断点继续迁移，避免重复操作
- ✅ **智能重试** - 自动处理临时错误，支持多种重试策略
- ✅ **完整镜像** - 保留所有分支、标签和提交历史
- ✅ **自动创建** - 自动创建目标仓库并更新项目描述
- ✅ **详细日志** - 完整的迁移日志和进度报告
- ✅ **配置备份** - 自动备份配置文件，防止数据丢失
- ✅ **预检查机制** - 验证权限和网络连通性
- ✅ **垃圾清理** - 自动清理临时文件和过期备份
- ✅ **彩色输出** - 美观的控制台输出，便于查看状态

## 🔧 环境要求

### 操作系统
- **Windows**: Windows 10 及以上版本
- **macOS**: macOS 10.15 及以上版本
- **Linux**: Ubuntu 18.04+ / CentOS 7+ / 其他主流发行版

### 运行时环境
- **Bun**: v1.0.0 及以上版本
- **Node.js**: v18.0.0 及以上版本 (备选)
- **Git**: v2.20.0 及以上版本

### GitLab 版本
- **GitLab CE/EE**: v13.0 及以上版本
- **GitLab.com**: 完全支持
- **自托管 GitLab**: 需要 API v4 支持

### 权限要求
- **源仓库**: 至少需要 `Reporter` 权限（读取权限）
- **目标分组**: 需要 `Developer` 或 `Maintainer` 权限（创建仓库权限）
- **Access Token**: 需要 `api`, `read_repository`, `write_repository` 权限

## 🚀 快速开始

### 1. 安装 Bun

```bash
# doc
https://bun.sh/docs/installation

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

### 2. 获取工具

```bash
# bun
bun install --global @garynan/migrate-gitlab
```

### 3. 初始化配置

```bash
# 创建配置文件
mgitlab init

# 或指定目录
mgitlab init /path/to/project
```

### 4. 编辑配置文件

编辑生成的 `move.md` 文件，填入正确的信息：

```markdown
# Gitlab 项目迁移到新的分组

## 迁移目标 Access Token

glpat-xxxxxxxxxxxxxxxxxxxx

## 迁移目标分组

https://gitlab.example.com/new-group/

## 需要迁移仓库

| 项目名称 | 项目描述 | 原仓库地址 |
|---------|---------|----------|
| my-project | 我的项目 | ssh://git@gitlab.example.com:10022/old-group/my-project.git |
```

### 5. 开始迁移

```bash
# 迁移所有项目
mgitlab

# 迁移指定项目
mgitlab --projects "project1,project2"

# 跳过克隆迁移项目到本地
mgitlab -s
```

## 📦 获取工具

```bash
# bun
bun install --global @garynan/migrate-gitlab

# npm
npm install --global @garynan/migrate-gitlab

# github
https://github.com/Garynan52000/migrate-gitlab

# gitee
https://gitee.com/Garynan/migrate-gitlab
```

## 📖 使用方法

### 使用命令

```bash
# 全局安装后
migrate-gitlab [选项] [参数]
mgitlab [选项] [参数]
```

### 命令说明

#### 主要命令

| 命令 | 描述 | 示例 |
|------|------|------|
| `init [目录]` | 初始化配置文件 | `mgitlab init` |
| `migrate [配置文件]` | 执行迁移任务 | `mgitlab migrate ./move.md` |

#### 选项参数

| 参数 | 简写 | 描述 | 示例 |
|------|------|------|------|
| `--help` | `-h` | 显示帮助信息 | `mgitlab --help` |
| `--version` | `-v` | 显示版本信息 | `mgitlab --version` |
| `--projects` | `-p` | 指定要迁移的项目列表 | `mgitlab --projects "proj1,proj2"` |
| `--token` | `-t` | 指定 GitLab Access Token | `mgitlab --token glpat-xxx` |
| `--skip-clone` | `-s` | 禁用克隆迁移后的仓库到本地 | `mgitlab --skip-clone` |
| `--quiet` | `-q` | 简化控制台输出，隐藏命令执行详情 | `mgitlab --quiet` |

## ⚙️ 配置文件

配置文件 `move.md` 采用 Markdown 格式，结构清晰易读：

```markdown
# Gitlab 项目迁移到新的分组

## 迁移目标 Access Token

glpat-xxxxxxxxxxxxxxxxxxxx

## 迁移目标分组

https://gitlab.example.com/new-group/

## 需要迁移仓库

| 项目名称 | 项目描述 | 原仓库地址 |
|---------|---------|----------|
| frontend-app | 前端应用项目 | ssh://git@gitlab.example.com:10022/old-group/frontend-app.git |
| backend-api | 后端 API 服务 | https://gitlab.example.com/old-group/backend-api.git |
| mobile-app | 移动端应用 | git@gitlab.example.com:old-group/mobile-app.git |

## 日志

<!-- 迁移日志将自动生成在这里 -->
```

### 配置说明

#### Access Token 获取方法

1. 登录 GitLab
2. 进入 **Settings** → **Access Tokens**
3. 创建新的 Personal Access Token
4. 选择权限：`api`, `read_repository`, `write_repository`
5. 复制生成的 Token 到配置文件中

#### 仓库地址格式支持

- **SSH 格式**: `ssh://git@gitlab.example.com:10022/group/project.git`
- **HTTPS 格式**: `https://gitlab.example.com/group/project.git`
- **Git 格式**: `git@gitlab.example.com:group/project.git`

## 📚 使用示例

### 基本迁移

```bash
# 1. 初始化配置
mgitlab init

# 2. 编辑 move.md 文件
# 填入 Access Token、目标分组和仓库信息

# 3. 开始迁移
mgitlab
```

### 指定配置文件

```bash
# 使用自定义配置文件
mgitlab ./custom-config.md
```

### 迁移指定项目

```bash
# 只迁移指定的项目
mgitlab --projects "frontend,backend"

# 使用位置参数
mgitlab ./move.md "frontend,backend"
```

### 使用命令行 Token

```bash
# 通过命令行提供 Access Token
mgitlab --token glpat-xxxxxxxxxxxxxxxxxxxx   

# 使用位置参数
mgitlab ./move.md "" glpat-xxxxxxxxxxxxxxxxxxxx
```

### 跳过克隆

```bash
# 跳过克隆迁移后的仓库到本地
mgitlab --skip-clone
```

### 静默模式

```bash
# 使用静默模式，简化控制台输出
mgitlab --quiet
```

### 环境变量

```bash
# 设置环境变量
export GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx

# 运行迁移（会自动使用环境变量中的 Token）
mgitlab
```

### 批量操作

```bash
# 为多个项目创建配置文件
mkdir project-a project-b project-c

# 在每个目录中初始化配置
cd project-a && mgitlab init
cd ../project-b && mgitlab init
cd ../project-c && mgitlab init

# 分别配置和迁移
cd project-a && mgitlab
cd ../project-b && mgitlab
cd ../project-c && mgitlab
```

## 🔥 高级功能

### 断点续传

工具支持断点续传功能，当迁移过程中断时，可以从上次中断的地方继续：

```bash
# 如果迁移中断，直接重新运行即可继续
mgitlab

# 工具会自动检测已完成的步骤，跳过已完成的操作
```

### 智能重试

工具内置智能重试机制，会根据错误类型自动重试：

- **网络错误**: 最多重试 5 次，指数退避延迟
- **API 限流**: 最多重试 3 次，固定延迟
- **Git 操作错误**: 最多重试 3 次
- **权限错误**: 不重试，直接报错

### 配置备份

工具会自动备份配置文件，防止数据丢失：

```bash
# 备份文件命名格式
move.md.backup.YYYY-MM-DD-HH-mm-ss

# 自动清理 7 天前的备份文件
```

### 垃圾清理

工具会自动清理临时文件：

- 迁移完成后自动删除临时克隆目录
- 清理超过 24 小时的临时目录
- 清理超过 7 天的配置备份文件

### 预检查机制

在开始迁移前，工具会进行全面的预检查：

1. **网络连通性检查** - 验证能否访问 GitLab API
2. **权限验证** - 检查 Access Token 权限
3. **目标分组权限** - 验证是否有创建仓库的权限
4. **Git 环境检查** - 验证本地 Git 配置
5. **配置文件验证** - 检查配置文件格式和内容

## 🔍 故障排除

### 常见问题

#### 1. Access Token 权限不足

**错误信息**:
```
❌ GitLab API 权限验证失败: 401 Unauthorized
```

**解决方法**:
- 检查 Access Token 是否正确
- 确保 Token 具备 `api`, `read_repository`, `write_repository` 权限
- 检查 Token 是否已过期

#### 2. 目标分组权限不足

**错误信息**:
```
❌ 目标分组权限验证失败: 403 Forbidden
```

**解决方法**:
- 确保在目标分组中具备 `Developer` 或 `Maintainer` 权限
- 检查分组路径是否正确
- 联系分组管理员添加权限

#### 3. 网络连接问题

**错误信息**:
```
❌ 网络连通性检查失败: ENOTFOUND
```

**解决方法**:
- 检查网络连接
- 确认 GitLab 服务器地址正确
- 检查防火墙和代理设置

#### 4. Git 配置问题

**错误信息**:
```
❌ Git 环境检查失败: git command not found
```

**解决方法**:
- 安装 Git: https://git-scm.com/downloads
- 配置 Git 用户信息:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```

#### 5. 仓库已存在

**错误信息**:
```
⚠️ 目标仓库已存在: project-name
```

**解决方法**:
- 选择覆盖现有仓库（如果为空）
- 重命名目标仓库
- 手动删除现有仓库后重试

### 查看日志

如果遇到问题，可以查看详细的日志信息：

```bash
# 工具会在配置文件中自动记录详细日志
# 查看 move.md 文件的 "## 日志" 部分

# 或者查看控制台输出的彩色日志
```

### 删除日志重试

如果需要重试迁移，可以删除配置文件中的日志部分。最好只删除异常项目的日志。

## ⚠️ 注意事项

### 安全注意事项

1. **Access Token 安全**
   - 不要将 Access Token 提交到版本控制系统
   - 定期轮换 Access Token
   - 使用最小权限原则

2. **配置文件安全**
   - 将 `move.md` 添加到 `.gitignore`
   - 迁移完成后及时删除包含敏感信息的配置文件

3. **网络安全**
   - 在安全的网络环境中运行
   - 避免在公共网络中传输敏感数据

### 性能注意事项

1. **大仓库迁移**
   - 大型仓库迁移可能需要较长时间
   - 确保网络连接稳定
   - 考虑在服务器上运行以获得更好的网络条件

2. **并发限制**
   - 工具采用串行迁移，避免对 GitLab 服务器造成压力
   - 不建议同时运行多个迁移实例

3. **存储空间**
   - 确保本地有足够的磁盘空间存储临时克隆
   - 工具会自动清理临时文件

### 兼容性注意事项

1. **GitLab 版本**
   - 支持 GitLab CE/EE v13.0+
   - 某些功能可能在旧版本中不可用

2. **Git 版本**
   - 推荐使用 Git v2.20.0+
   - 某些高级功能需要较新的 Git 版本

3. **操作系统**
   - Windows 用户建议使用 PowerShell
   - 路径分隔符会自动处理

### 最佳实践

1. **迁移前准备**
   - 备份重要数据
   - 通知团队成员迁移计划
   - 在测试环境中先行验证

2. **迁移过程中**
   - 监控迁移进度
   - 保持网络连接稳定
   - 不要中断正在进行的迁移

3. **迁移后验证**
   - 检查所有分支和标签是否完整
   - 验证仓库权限设置
   - 更新本地克隆的远程地址

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**🎉 感谢使用！**